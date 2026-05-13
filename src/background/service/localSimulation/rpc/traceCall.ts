import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import providerController from '../../../controller/provider/controller';
import { CallFrame, PrestateDiff, TraceResult } from '../types';

type TraceCallParams = [
  Record<string, string | undefined>,
  string,
  {
    tracer: string;
    tracerConfig?: { diffMode?: boolean; withLog?: boolean };
  }
];

const buildTraceTx = (tx: Tx) => {
  const out: Record<string, string | undefined> = {
    from: tx.from,
    to: tx.to || undefined,
    data: tx.data || undefined,
    value: tx.value || undefined,
    gas: tx.gas || tx.gasLimit || undefined,
    gasPrice: tx.gasPrice || undefined,
    maxFeePerGas: tx.maxFeePerGas || undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas || undefined,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
};

const extractError = (e: unknown): { message: string; code?: number } => {
  const err = e as
    | { message?: string; code?: number; data?: { message?: string } }
    | undefined;
  const message =
    err?.data?.message ||
    err?.message ||
    (typeof e === 'string' ? e : '') ||
    'rpc error';
  const code = typeof err?.code === 'number' ? err.code : undefined;
  return { message, code };
};

const rawRpc = async <T>(
  serverId: string,
  method: string,
  params: unknown[]
): Promise<TraceResult<T>> => {
  try {
    const res = await providerController.ethRpc(
      {
        data: { method, params },
        session: INTERNAL_REQUEST_SESSION,
      } as any,
      serverId
    );
    return { kind: 'ok', value: res as T };
  } catch (e) {
    return { kind: 'error', ...extractError(e) };
  }
};

export const tracePrestateDiff = async (
  chainServerId: string,
  tx: Tx
): Promise<TraceResult<PrestateDiff>> => {
  const params: TraceCallParams = [
    buildTraceTx(tx),
    'latest',
    { tracer: 'prestateTracer', tracerConfig: { diffMode: true } },
  ];
  const res = await rawRpc<PrestateDiff>(
    chainServerId,
    'debug_traceCall',
    (params as unknown) as unknown[]
  );
  if (res.kind === 'error') return res;
  const v = res.value;
  if (!v || typeof v !== 'object' || !v.pre || !v.post) {
    return { kind: 'error', message: 'unexpected prestate trace shape' };
  }
  return { kind: 'ok', value: v };
};

export const traceCallTracer = async (
  chainServerId: string,
  tx: Tx
): Promise<TraceResult<CallFrame>> => {
  const params: TraceCallParams = [
    buildTraceTx(tx),
    'latest',
    { tracer: 'callTracer', tracerConfig: { withLog: true } },
  ];
  const res = await rawRpc<CallFrame>(
    chainServerId,
    'debug_traceCall',
    (params as unknown) as unknown[]
  );
  if (res.kind === 'error') return res;
  const v = res.value;
  if (!v || typeof v !== 'object') {
    return { kind: 'error', message: 'unexpected call trace shape' };
  }
  return { kind: 'ok', value: v };
};
