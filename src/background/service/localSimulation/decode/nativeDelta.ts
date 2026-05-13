import BigNumber from 'bignumber.js';
import { PrestateDiff } from '../types';

export interface NativeDelta {
  address: string;
  pre: BigNumber;
  post: BigNumber;
  delta: BigNumber;
}

const hexOrZero = (s?: string) => new BigNumber(s && s !== '0x' ? s : 0);

export const extractNativeDeltas = (diff: PrestateDiff): NativeDelta[] => {
  const addresses = new Set<string>([
    ...Object.keys(diff.pre || {}),
    ...Object.keys(diff.post || {}),
  ]);
  const out: NativeDelta[] = [];
  for (const addr of addresses) {
    const preBalRaw = diff.pre?.[addr]?.balance;
    const postBalRaw = diff.post?.[addr]?.balance;
    // diffMode omits fields that didn't change. If post.balance is absent the
    // balance is unchanged — not zero. Likewise pre.balance absent means the
    // account didn't exist before the call.
    if (preBalRaw === undefined && postBalRaw === undefined) continue;
    const pre = hexOrZero(preBalRaw);
    const post = postBalRaw !== undefined ? hexOrZero(postBalRaw) : pre;
    const delta = post.minus(pre);
    if (!delta.isZero()) {
      out.push({ address: addr.toLowerCase(), pre, post, delta });
    }
  }
  return out;
};
