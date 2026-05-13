import { Tx, BalanceChange } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

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

export interface TraceLog {
  address: string;
  topics: string[];
  data: string;
}

export interface CallFrame {
  type?: string;
  from?: string;
  to?: string;
  value?: string;
  input?: string;
  output?: string;
  error?: string;
  logs?: TraceLog[];
  calls?: CallFrame[];
}

export interface Erc20Delta {
  token: string;
  address: string;
  delta: BigNumber;
}

export interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}
