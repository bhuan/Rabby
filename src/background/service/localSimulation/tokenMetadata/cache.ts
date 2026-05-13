import { TokenMeta } from '../types';

interface CacheEntry {
  meta: TokenMeta | null;
  ts: number;
}

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const key = (chainId: number, token: string) =>
  `${chainId}:${token.toLowerCase()}`;

export const getCached = (
  chainId: number,
  token: string
): TokenMeta | null | undefined => {
  const e = cache.get(key(chainId, token));
  if (!e) return undefined;
  if (Date.now() - e.ts > TTL_MS) {
    cache.delete(key(chainId, token));
    return undefined;
  }
  return e.meta;
};

export const setCached = (
  chainId: number,
  token: string,
  meta: TokenMeta | null
) => {
  cache.set(key(chainId, token), { meta, ts: Date.now() });
};

export const invalidate = (chainId: number, token?: string) => {
  if (token) cache.delete(key(chainId, token));
  else cache.clear();
};
