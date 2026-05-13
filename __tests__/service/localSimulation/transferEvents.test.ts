import { extractErc20Deltas } from '@/background/service/localSimulation/decode/transferEvents';
import { CallFrame } from '@/background/service/localSimulation/types';

const TOPIC_TRANSFER =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC_DEPOSIT =
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';
const TOPIC_WITHDRAWAL =
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65';

const ADDR_A = '0x000000000000000000000000000000000000aaaa';
const ADDR_B = '0x000000000000000000000000000000000000bbbb';
const ADDR_C = '0x000000000000000000000000000000000000cccc';
const WMON = '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701';

const addrTopic = (addr: string) =>
  '0x' + addr.replace(/^0x/, '').padStart(64, '0');

const u256 = (n: bigint | number) =>
  '0x' + BigInt(n).toString(16).padStart(64, '0');

describe('extractErc20Deltas', () => {
  it('returns no deltas when there are no relevant logs', () => {
    const frame: CallFrame = { logs: [] };
    expect(extractErc20Deltas(frame)).toEqual([]);
  });

  it('extracts a single ERC-20 Transfer', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [TOPIC_TRANSFER, addrTopic(ADDR_A), addrTopic(ADDR_B)],
          data: u256(1000n),
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    expect(out).toHaveLength(2);
    const a = out.find((d) => d.address === ADDR_A)!;
    const b = out.find((d) => d.address === ADDR_B)!;
    expect(a.token).toBe(WMON);
    expect(a.delta.toFixed()).toBe('-1000');
    expect(b.delta.toFixed()).toBe('1000');
  });

  it('aggregates multi-hop transfers per (token, address)', () => {
    const frame: CallFrame = {
      calls: [
        {
          logs: [
            {
              address: WMON,
              topics: [TOPIC_TRANSFER, addrTopic(ADDR_A), addrTopic(ADDR_C)],
              data: u256(500n),
            },
          ],
        },
        {
          logs: [
            {
              address: WMON,
              topics: [TOPIC_TRANSFER, addrTopic(ADDR_C), addrTopic(ADDR_B)],
              data: u256(500n),
            },
          ],
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    const a = out.find((d) => d.address === ADDR_A)!;
    const b = out.find((d) => d.address === ADDR_B)!;
    const c = out.find((d) => d.address === ADDR_C);
    expect(a.delta.toFixed()).toBe('-500');
    expect(b.delta.toFixed()).toBe('500');
    // C is a pass-through hop, net zero → omitted.
    expect(c).toBeUndefined();
  });

  it('mints (Transfer from 0x0) only credit the recipient', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [
            TOPIC_TRANSFER,
            addrTopic('0x0000000000000000000000000000000000000000'),
            addrTopic(ADDR_A),
          ],
          data: u256(7n),
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    expect(out).toEqual([
      expect.objectContaining({
        token: WMON,
        address: ADDR_A,
      }),
    ]);
    expect(out[0].delta.toFixed()).toBe('7');
  });

  it('burns (Transfer to 0x0) only debit the sender', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [
            TOPIC_TRANSFER,
            addrTopic(ADDR_A),
            addrTopic('0x0000000000000000000000000000000000000000'),
          ],
          data: u256(9n),
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    expect(out).toHaveLength(1);
    expect(out[0].address).toBe(ADDR_A);
    expect(out[0].delta.toFixed()).toBe('-9');
  });

  it('decodes WETH-style Deposit as credit-only', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [TOPIC_DEPOSIT, addrTopic(ADDR_A)],
          data: u256(1000n),
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(
      expect.objectContaining({ token: WMON, address: ADDR_A })
    );
    expect(out[0].delta.toFixed()).toBe('1000');
  });

  it('decodes WETH-style Withdrawal as debit-only', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [TOPIC_WITHDRAWAL, addrTopic(ADDR_A)],
          data: u256(1000n),
        },
      ],
    };
    const out = extractErc20Deltas(frame);
    expect(out).toHaveLength(1);
    expect(out[0].delta.toFixed()).toBe('-1000');
  });

  it('skips logs from reverted call frames', () => {
    const frame: CallFrame = {
      calls: [
        {
          error: 'execution reverted',
          logs: [
            {
              address: WMON,
              topics: [TOPIC_TRANSFER, addrTopic(ADDR_A), addrTopic(ADDR_B)],
              data: u256(1000n),
            },
          ],
        },
      ],
    };
    expect(extractErc20Deltas(frame)).toEqual([]);
  });

  it('ignores logs with unrelated topic0', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [
            '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            addrTopic(ADDR_A),
            addrTopic(ADDR_B),
          ],
          data: u256(1n),
        },
      ],
    };
    expect(extractErc20Deltas(frame)).toEqual([]);
  });

  it('ignores zero-value transfers', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [TOPIC_TRANSFER, addrTopic(ADDR_A), addrTopic(ADDR_B)],
          data: u256(0n),
        },
      ],
    };
    expect(extractErc20Deltas(frame)).toEqual([]);
  });

  it('skips ERC-721 Transfer (4 topics, empty data)', () => {
    const frame: CallFrame = {
      logs: [
        {
          address: WMON,
          topics: [
            TOPIC_TRANSFER,
            addrTopic(ADDR_A),
            addrTopic(ADDR_B),
            u256(42n),
          ],
          data: '0x',
        },
      ],
    };
    expect(extractErc20Deltas(frame)).toEqual([]);
  });
});
