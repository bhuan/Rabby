import { findChain } from '@/utils/chain';
import BigNumber from 'bignumber.js';
import { getPolicy } from './chainPolicy';
import { probeDebugTraceCall } from './rpc/capabilityProbe';
import { traceCallTracer, tracePrestateDiff } from './rpc/traceCall';
import { extractNativeDeltas } from './decode/nativeDelta';
import { extractErc20Deltas } from './decode/transferEvents';
import { fetchManyTokenMeta } from './tokenMetadata/fetch';
import { enrichBalanceChangePricing } from './pricing/enrich';
import {
  synthesizeFailedBalanceChange,
  synthesizeContractBalanceChange,
  synthesizeNativeBalanceChange,
} from './synthesize/balanceChange';
import { LocalSimulationInput, LocalSimulationResult } from './types';

const isEmptyData = (data?: string) => !data || data === '0x' || data === '0x0';

// Verbose simulator tracing. Off by default — tx payloads, user addresses,
// and decoded deltas shouldn't land in production extension logs. Flip on
// from the background-SW devtools with
//   globalThis.__rabbyDebugLocalSim__ = true
// when triaging a sim issue.
const log = (...args: unknown[]) => {
  if (
    (globalThis as { __rabbyDebugLocalSim__?: boolean })
      .__rabbyDebugLocalSim__
  ) {
    console.info('[local-sim]', ...args);
  }
};

// Geth-style JSON-RPC error code for "execution reverted" — what most wallets
// surface for a normal revert. Reserve -32603 ("internal error") for cases
// where the trace ran but produced an unexpected error shape.
const REVERT_ERROR_CODE = 3;
const INTERNAL_ERROR_CODE = -32603;

const isRevert = (msg: string) => /reverted|revert/i.test(msg);

const failedSimulationResult = (
  msg: string,
  code?: number
): LocalSimulationResult => ({
  balanceChange: synthesizeFailedBalanceChange({
    code: code ?? (isRevert(msg) ? REVERT_ERROR_CODE : INTERNAL_ERROR_CODE),
    msg,
  }),
  version: 'v1',
  source: 'local-trace',
  pricingSource: 'none',
});

export const simulate = async (
  input: LocalSimulationInput
): Promise<LocalSimulationResult | null> => {
  const { chainId, tx, userAddress } = input;
  log('start', { chainId, tx, userAddress });
  const policy = getPolicy(chainId);
  if (!policy || !policy.providers.includes('local-trace')) {
    log('bail: chain not in policy or local-trace not enabled', { chainId });
    return null;
  }

  const chain = findChain({ id: chainId });
  if (!chain) {
    log('bail: findChain returned null', { chainId });
    return null;
  }
  if (!tx.to) {
    log('bail: tx.to missing');
    return null;
  }
  const serverId = chain.serverId;

  const supported = await probeDebugTraceCall(serverId);
  if (!supported) {
    log('bail: debug_traceCall probe failed for this chain/RPC', {
      chainId,
      serverId,
    });
    return null;
  }

  if (isEmptyData(tx.data)) {
    const diff = await tracePrestateDiff(serverId, tx);
    if (diff.kind === 'error') {
      log('fail: native trace error', diff);
      return failedSimulationResult(diff.message, diff.code);
    }
    const deltas = extractNativeDeltas(diff.value);
    log('native path: deltas', { count: deltas.length, deltas });
    if (deltas.length === 0) {
      log('bail: no native deltas extracted');
      return null;
    }
    const balanceChange = synthesizeNativeBalanceChange({
      chain,
      userAddress,
      txValue: tx.value || '0x0',
      txTo: tx.to,
      deltas,
    });
    if (!balanceChange) {
      log('bail: native synthesize returned null (user not in deltas?)');
      return null;
    }
    const priced = await enrichBalanceChangePricing({
      chain,
      userAddress,
      balanceChange,
    });
    log('ok: native', priced);
    return {
      balanceChange: priced.balanceChange,
      version: 'v1',
      source: 'local-trace',
      pricingSource: priced.pricingSource,
    };
  }

  // Contract call: run callTracer + prestateTracer in parallel.
  const [callRes, prestateRes] = await Promise.all([
    traceCallTracer(serverId, tx),
    tracePrestateDiff(serverId, tx),
  ]);
  if (callRes.kind === 'error') {
    log('fail: contract callTracer error', callRes);
    return failedSimulationResult(callRes.message, callRes.code);
  }
  if (callRes.value.error) {
    log('fail: contract call reverted', { error: callRes.value.error });
    return failedSimulationResult(callRes.value.error);
  }
  if (prestateRes.kind === 'error') {
    log('fail: contract prestateTracer error', prestateRes);
    return failedSimulationResult(prestateRes.message, prestateRes.code);
  }

  const userLower = userAddress.toLowerCase();
  const nativeDeltas = extractNativeDeltas(prestateRes.value);
  const userNativeDelta = nativeDeltas.find((d) => d.address === userLower);
  const erc20Deltas = extractErc20Deltas(callRes.value);
  const userErc20 = erc20Deltas.filter((d) => d.address === userLower);
  const txValue = tx.value || '0x0';
  log('contract path', {
    nativeDeltas: nativeDeltas.length,
    erc20Deltas: erc20Deltas.length,
    userErc20: userErc20.length,
    txValue,
  });

  if (
    !userNativeDelta &&
    userErc20.length === 0 &&
    !new BigNumber(txValue).gt(0)
  ) {
    log('bail: no user activity in trace');
    return null;
  }

  const tokens = Array.from(new Set(userErc20.map((d) => d.token)));
  const metaByToken =
    tokens.length === 0
      ? new Map()
      : await fetchManyTokenMeta(chainId, serverId, tokens);

  const balanceChange = synthesizeContractBalanceChange({
    chain,
    userAddress,
    txValue,
    nativeDeltas,
    erc20Deltas: userErc20,
    metaByToken,
  });
  const priced = await enrichBalanceChangePricing({
    chain,
    userAddress,
    balanceChange,
  });
  log('ok: contract', priced);
  return {
    balanceChange: priced.balanceChange,
    version: 'v1',
    source: 'local-trace',
    pricingSource: priced.pricingSource,
  };
};

export type { LocalSimulationInput, LocalSimulationResult } from './types';
export { invalidateProbe } from './rpc/capabilityProbe';
