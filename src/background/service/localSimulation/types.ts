import { Tx, BalanceChange } from '@rabby-wallet/rabby-api/dist/types';

export type TraceResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'error'; message: string; code?: number };

export interface LocalSimulationInput {
  chainId: number;
  tx: Tx;
  userAddress: string;
}

export interface LocalSimulationResult {
  balanceChange: BalanceChange;
  version: 'v1';
  source: 'local-trace';
}

export interface PrestateDiff {
  pre: Record<string, { balance?: string } | undefined>;
  post: Record<string, { balance?: string } | undefined>;
}
