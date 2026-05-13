import {
  hexToString,
  encodeFunctionData,
  decodeFunctionResult,
  erc20Abi,
  parseAbi,
} from 'viem';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import providerController from '../../../controller/provider/controller';
import { TokenMeta } from '../types';
import { getCached, setCached } from './cache';
import { isValidDecimals, isValidName, isValidSymbol } from './validate';

const bytes32Abi = parseAbi([
  'function symbol() view returns (bytes32)',
  'function name() view returns (bytes32)',
]);

const trimRightPadding = (s: string): string => {
  let end = s.length;
  while (end > 0) {
    const c = s.charCodeAt(end - 1);
    if (c !== 0 && c !== 32) break;
    end--;
  }
  return s.slice(0, end);
};

const decodeBytes32 = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  try {
    const decoded = hexToString(raw as `0x${string}`, { size: 32 });
    const trimmed = trimRightPadding(decoded);
    return trimmed.length ? trimmed : null;
  } catch (e) {
    return null;
  }
};

const ethCall = async (
  serverId: string,
  to: string,
  data: `0x${string}`
): Promise<`0x${string}` | null> => {
  try {
    const res = await providerController.ethRpc(
      {
        data: {
          method: 'eth_call',
          params: [{ to, data }, 'latest'],
        },
        session: INTERNAL_REQUEST_SESSION,
      } as any,
      serverId
    );
    return typeof res === 'string' ? (res as `0x${string}`) : null;
  } catch (e) {
    return null;
  }
};

const readErc20Field = async <T>(
  serverId: string,
  address: `0x${string}`,
  fn: 'symbol' | 'decimals' | 'name'
): Promise<T | null> => {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: fn,
  });
  const raw = await ethCall(serverId, address, calldata);
  if (!raw) return null;
  try {
    return decodeFunctionResult({
      abi: erc20Abi,
      functionName: fn,
      data: raw,
    }) as T;
  } catch (e) {
    return null;
  }
};

const readBytes32Field = async (
  serverId: string,
  address: `0x${string}`,
  fn: 'symbol' | 'name'
): Promise<string | null> => {
  const calldata = encodeFunctionData({
    abi: bytes32Abi,
    functionName: fn,
  });
  const raw = await ethCall(serverId, address, calldata);
  if (!raw) return null;
  try {
    const decoded = decodeFunctionResult({
      abi: bytes32Abi,
      functionName: fn,
      data: raw,
    });
    return decodeBytes32(decoded);
  } catch (e) {
    return null;
  }
};

const readSymbol = async (
  serverId: string,
  address: `0x${string}`
): Promise<string | null> => {
  const s = await readErc20Field<string>(serverId, address, 'symbol');
  if (isValidSymbol(s)) return s;
  const s2 = await readBytes32Field(serverId, address, 'symbol');
  return isValidSymbol(s2) ? s2 : null;
};

const readName = async (
  serverId: string,
  address: `0x${string}`
): Promise<string | null> => {
  const s = await readErc20Field<string>(serverId, address, 'name');
  if (isValidName(s)) return s;
  const s2 = await readBytes32Field(serverId, address, 'name');
  return isValidName(s2) ? s2 : null;
};

const readDecimals = async (
  serverId: string,
  address: `0x${string}`
): Promise<number | null> => {
  const d = await readErc20Field<number | bigint>(
    serverId,
    address,
    'decimals'
  );
  if (d === null) return null;
  const n = typeof d === 'number' ? d : Number(d);
  return isValidDecimals(n) ? n : null;
};

export const fetchTokenMeta = async (
  chainId: number,
  chainServerId: string,
  token: string
): Promise<TokenMeta | null> => {
  const cached = getCached(chainId, token);
  if (cached !== undefined) return cached;

  const address = token as `0x${string}`;
  const [symbol, decimals, name] = await Promise.all([
    readSymbol(chainServerId, address),
    readDecimals(chainServerId, address),
    readName(chainServerId, address),
  ]);

  if (!symbol || decimals === null) {
    setCached(chainId, token, null);
    return null;
  }

  const meta: TokenMeta = {
    address: token.toLowerCase(),
    symbol,
    decimals,
    name: name || symbol,
  };
  setCached(chainId, token, meta);
  return meta;
};

// Returns metadata for the tokens that resolved. Tokens that fail (NFT
// contracts, non-standard ERC-20s, RPC hiccups) are silently dropped so a
// single bad address doesn't poison the whole simulation — synthesize skips
// deltas whose token is missing from the map.
export const fetchManyTokenMeta = async (
  chainId: number,
  chainServerId: string,
  tokens: string[]
): Promise<Map<string, TokenMeta>> => {
  const unique = Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  const results = await Promise.all(
    unique.map((t) => fetchTokenMeta(chainId, chainServerId, t))
  );
  const out = new Map<string, TokenMeta>();
  for (let i = 0; i < unique.length; i++) {
    const r = results[i];
    if (r) out.set(unique[i], r);
  }
  return out;
};
