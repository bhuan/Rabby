import BigNumber from 'bignumber.js';
import { BalanceChange, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@debank/common';
import { NativeDelta } from '../decode/nativeDelta';
import { Erc20Delta, TokenMeta } from '../types';

const buildNativeToken = (chain: Chain, rawAmount: BigNumber): TokenItem => {
  const decimals = chain.nativeTokenDecimals || 18;
  const amount = rawAmount
    .abs()
    .div(new BigNumber(10).pow(decimals))
    .toNumber();
  return {
    id: chain.nativeTokenAddress || chain.serverId,
    chain: chain.serverId,
    amount,
    raw_amount: rawAmount.abs().toFixed(0),
    raw_amount_hex_str: `0x${new BigNumber(rawAmount.abs().toFixed(0)).toString(
      16
    )}`,
    decimals,
    display_symbol: chain.nativeTokenSymbol,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    logo_url: chain.nativeTokenLogo || '',
    name: chain.nativeTokenSymbol,
    optimized_symbol: chain.nativeTokenSymbol,
    price: 0,
    symbol: chain.nativeTokenSymbol,
    time_at: 0,
    price_24h_change: 0,
  };
};

const buildErc20Token = (
  chain: Chain,
  meta: TokenMeta,
  rawAmount: BigNumber
): TokenItem => {
  const amount = rawAmount
    .abs()
    .div(new BigNumber(10).pow(meta.decimals))
    .toNumber();
  return {
    id: meta.address,
    chain: chain.serverId,
    amount,
    raw_amount: rawAmount.abs().toFixed(0),
    raw_amount_hex_str: `0x${new BigNumber(rawAmount.abs().toFixed(0)).toString(
      16
    )}`,
    decimals: meta.decimals,
    display_symbol: meta.symbol,
    is_core: false,
    // null is the "unknown / not in catalog" sentinel — distinct from
    // is_verified: false, which is DeBank's positive "this is an imposter"
    // signal and surfaces as the alarming "fake" badge. mergePricedToken
    // overwrites with DeBank's real flag when the token is catalogued
    // (mainnet), so verified tokens render clean. Testnet and uncataloged
    // mainnet tokens stay null and get the neutral "unverified" badge.
    is_verified: null,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    logo_url: '',
    name: meta.name,
    optimized_symbol: meta.symbol,
    price: 0,
    symbol: meta.symbol,
    time_at: 0,
    price_24h_change: 0,
  };
};

const baseChange = (
  error: { code: number; msg: string } | null
): BalanceChange =>
  (({
    success: error === null,
    error,
    send_token_list: [],
    receive_token_list: [],
    send_nft_list: [],
    receive_nft_list: [],
    usd_value_change: 0,
  } as unknown) as BalanceChange);

const emptyChange = () => baseChange(null);

export const synthesizeFailedBalanceChange = ({
  code,
  msg,
}: {
  code: number;
  msg: string;
}): BalanceChange => baseChange({ code, msg });

export const synthesizeNativeBalanceChange = ({
  chain,
  userAddress,
  txValue,
  txTo,
  deltas,
}: {
  chain: Chain;
  userAddress: string;
  txValue: string;
  txTo: string;
  deltas: NativeDelta[];
}): BalanceChange | null => {
  const user = userAddress.toLowerCase();
  const userDelta = deltas.find((d) => d.address === user);
  if (!userDelta) return null;

  const change = emptyChange();
  // Trace balance deltas can include gas accounting; show the signed transfer value.
  const value = new BigNumber(txValue && txValue !== '0x' ? txValue : 0);
  if (!value.gt(0)) return change;

  const to = txTo.toLowerCase();
  change.send_token_list = [buildNativeToken(chain, value)];
  if (user === to) {
    change.receive_token_list = [buildNativeToken(chain, value)];
  }
  return change;
};

export const synthesizeContractBalanceChange = ({
  chain,
  userAddress,
  txValue,
  nativeDeltas,
  erc20Deltas,
  metaByToken,
}: {
  chain: Chain;
  userAddress: string;
  txValue: string;
  nativeDeltas: NativeDelta[];
  erc20Deltas: Erc20Delta[];
  metaByToken: Map<string, TokenMeta>;
}): BalanceChange => {
  const user = userAddress.toLowerCase();
  const change = emptyChange();

  const sendTokens: TokenItem[] = [];
  const receiveTokens: TokenItem[] = [];

  // Native MON sent with the call (value field) — surface as send if > 0.
  const nativeValue = new BigNumber(txValue && txValue !== '0x' ? txValue : 0);
  if (nativeValue.gt(0)) {
    sendTokens.push(buildNativeToken(chain, nativeValue));
  }

  const nativeDelta = nativeDeltas.find((d) => d.address === user);
  if (nativeDelta?.delta.gt(0)) {
    receiveTokens.push(buildNativeToken(chain, nativeDelta.delta));
  }

  for (const d of erc20Deltas) {
    if (d.address !== user) continue;
    const meta = metaByToken.get(d.token);
    // Skip unresolved tokens (likely NFTs or non-standard contracts whose
    // metadata fetch failed); other deltas still render.
    if (!meta) continue;
    const item = buildErc20Token(chain, meta, d.delta);
    if (d.delta.lt(0)) sendTokens.push(item);
    else if (d.delta.gt(0)) receiveTokens.push(item);
  }

  change.send_token_list = sendTokens;
  change.receive_token_list = receiveTokens;
  return change;
};
