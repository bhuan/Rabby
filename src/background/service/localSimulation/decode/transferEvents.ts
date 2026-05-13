import BigNumber from 'bignumber.js';
import { CallFrame, Erc20Delta, TraceLog } from '../types';

const TOPIC_TRANSFER =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC_DEPOSIT =
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';
const TOPIC_WITHDRAWAL =
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65';

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const lowercase = (a: string) => a.toLowerCase();

const topicToAddress = (topic: string): string =>
  '0x' + topic.slice(-40).toLowerCase();

const hexDataToBigNumber = (data: string): BigNumber => {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  if (clean.length === 0) return new BigNumber(0);
  return new BigNumber('0x' + clean);
};

const flattenLogs = (frame: CallFrame): TraceLog[] => {
  const out: TraceLog[] = [];
  const walk = (f?: CallFrame) => {
    if (!f) return;
    if (f.error) return;
    if (f.logs) {
      for (const l of f.logs) {
        if (l && l.topics && l.topics.length > 0) out.push(l);
      }
    }
    if (f.calls) for (const c of f.calls) walk(c);
  };
  walk(frame);
  return out;
};

export const extractErc20Deltas = (frame: CallFrame): Erc20Delta[] => {
  const logs = flattenLogs(frame);
  const acc = new Map<string, BigNumber>();
  const bump = (token: string, address: string, delta: BigNumber) => {
    const key = `${token}|${address}`;
    const prev = acc.get(key) || new BigNumber(0);
    acc.set(key, prev.plus(delta));
  };

  for (const log of logs) {
    const token = lowercase(log.address);
    const topic0 = (log.topics[0] || '').toLowerCase();

    // ERC-20 Transfer has 3 topics (sig, from, to) with the amount in data.
    // ERC-721 uses the same topic0 but with 4 topics (sig, from, to, tokenId)
    // and empty data — skip those, otherwise the tokenId would later be
    // misread as a balance delta and force the whole sim to bail.
    if (topic0 === TOPIC_TRANSFER && log.topics.length === 3) {
      const from = topicToAddress(log.topics[1]);
      const to = topicToAddress(log.topics[2]);
      const amount = hexDataToBigNumber(log.data || '0x');
      if (amount.isZero()) continue;
      if (from !== ADDRESS_ZERO) bump(token, from, amount.negated());
      if (to !== ADDRESS_ZERO) bump(token, to, amount);
      continue;
    }

    if (topic0 === TOPIC_DEPOSIT && log.topics.length >= 2) {
      const to = topicToAddress(log.topics[1]);
      const amount = hexDataToBigNumber(log.data || '0x');
      if (amount.isZero()) continue;
      bump(token, to, amount);
      continue;
    }

    if (topic0 === TOPIC_WITHDRAWAL && log.topics.length >= 2) {
      const from = topicToAddress(log.topics[1]);
      const amount = hexDataToBigNumber(log.data || '0x');
      if (amount.isZero()) continue;
      bump(token, from, amount.negated());
      continue;
    }
  }

  const out: Erc20Delta[] = [];
  for (const [key, delta] of acc.entries()) {
    if (delta.isZero()) continue;
    const [token, address] = key.split('|');
    out.push({ token, address, delta });
  }
  return out;
};
