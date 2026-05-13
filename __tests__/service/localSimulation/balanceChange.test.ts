import BigNumber from 'bignumber.js';
import {
  synthesizeContractBalanceChange,
  synthesizeNativeBalanceChange,
} from '@/background/service/localSimulation/synthesize/balanceChange';
import { TokenMeta } from '@/background/service/localSimulation/types';

const fakeChain = {
  id: 10143,
  serverId: 'custom_10143',
  nativeTokenAddress: 'custom_10143',
  nativeTokenSymbol: 'MON',
  nativeTokenDecimals: 18,
  nativeTokenLogo: '',
} as any;

const USER = '0x0000000000000000000000000000000000000123';
const WMON = '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701';

const wmonMeta: TokenMeta = {
  address: WMON,
  symbol: 'WMON',
  decimals: 18,
  name: 'Wrapped Monad',
};

describe('synthesizeNativeBalanceChange', () => {
  it('returns null when the user is not in the prestate deltas', () => {
    const res = synthesizeNativeBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x38d7ea4c68000',
      txTo: '0x000000000000000000000000000000000000dead',
      deltas: [],
    });
    expect(res).toBeNull();
  });

  it('surfaces tx.value as a single send entry for a normal native transfer', () => {
    const res = synthesizeNativeBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x38d7ea4c68000',
      txTo: '0x000000000000000000000000000000000000dead',
      deltas: [
        {
          address: USER.toLowerCase(),
          pre: new BigNumber('1000000000000000000'),
          post: new BigNumber('990000000000000000'),
          delta: new BigNumber('-10000000000000000'),
        },
      ],
    });
    expect(res).not.toBeNull();
    expect(res!.send_token_list).toHaveLength(1);
    expect(res!.send_token_list[0].symbol).toBe('MON');
    expect(res!.send_token_list[0].amount).toBeCloseTo(0.001, 12);
    expect(res!.receive_token_list).toHaveLength(0);
  });

  it('shows both send and receive for self-transfer', () => {
    const res = synthesizeNativeBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x38d7ea4c68000',
      txTo: USER,
      deltas: [
        {
          address: USER.toLowerCase(),
          pre: new BigNumber('1'),
          post: new BigNumber('0'),
          delta: new BigNumber('-1'),
        },
      ],
    });
    expect(res!.send_token_list).toHaveLength(1);
    expect(res!.receive_token_list).toHaveLength(1);
  });
});

describe('synthesizeContractBalanceChange', () => {
  it('renders WMON deposit (wrap): native send + WMON receive', () => {
    const res = synthesizeContractBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x38d7ea4c68000', // 0.001 MON
      nativeDeltas: [],
      erc20Deltas: [
        {
          token: WMON,
          address: USER.toLowerCase(),
          delta: new BigNumber('1000000000000000'),
        },
      ],
      metaByToken: new Map([[WMON, wmonMeta]]),
    });
    expect(res.send_token_list).toHaveLength(1);
    expect(res.send_token_list[0].symbol).toBe('MON');
    expect(res.receive_token_list).toHaveLength(1);
    expect(res.receive_token_list[0].symbol).toBe('WMON');
    expect(res.receive_token_list[0].amount).toBeCloseTo(0.001, 12);
  });

  it('synthesized ERC-20 tokens default to is_verified: null until pricing merges in', () => {
    // null is the "unknown" sentinel — distinct from `false`, which is
    // DeBank's "this is an imposter" signal. Lets the UI render a neutral
    // "unverified" badge instead of the alarming "fake" badge.
    const res = synthesizeContractBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x0',
      nativeDeltas: [],
      erc20Deltas: [
        {
          token: WMON,
          address: USER.toLowerCase(),
          delta: new BigNumber('1000000000000000'),
        },
      ],
      metaByToken: new Map([[WMON, wmonMeta]]),
    });
    const wmon = res.receive_token_list[0];
    expect(wmon.is_verified).toBeNull();
    expect(wmon.is_scam).toBe(false);
    expect(wmon.is_suspicious).toBe(false);
  });

  it('renders WMON withdraw (unwrap): WMON send + native receive when value=0', () => {
    const res = synthesizeContractBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x0',
      nativeDeltas: [
        {
          address: USER.toLowerCase(),
          pre: new BigNumber('1000000000000000000'),
          post: new BigNumber('1001000000000000000'),
          delta: new BigNumber('1000000000000000'),
        },
      ],
      erc20Deltas: [
        {
          token: WMON,
          address: USER.toLowerCase(),
          delta: new BigNumber('-1000000000000000'),
        },
      ],
      metaByToken: new Map([[WMON, wmonMeta]]),
    });
    expect(res.send_token_list).toHaveLength(1);
    expect(res.send_token_list[0].symbol).toBe('WMON');
    expect(res.receive_token_list).toHaveLength(1);
    expect(res.receive_token_list[0].symbol).toBe('MON');
    expect(res.receive_token_list[0].amount).toBeCloseTo(0.001, 12);
  });

  it('skips deltas whose token has no metadata (e.g. NFT contracts)', () => {
    const res = synthesizeContractBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x0',
      nativeDeltas: [],
      erc20Deltas: [
        {
          token: WMON,
          address: USER.toLowerCase(),
          delta: new BigNumber('1'),
        },
      ],
      metaByToken: new Map(),
    });
    expect(res.send_token_list).toHaveLength(0);
    expect(res.receive_token_list).toHaveLength(0);
  });

  it('only surfaces deltas for the signing user', () => {
    const other = '0x000000000000000000000000000000000000beef';
    const res = synthesizeContractBalanceChange({
      chain: fakeChain,
      userAddress: USER,
      txValue: '0x0',
      nativeDeltas: [],
      erc20Deltas: [
        {
          token: WMON,
          address: other,
          delta: new BigNumber('1'),
        },
      ],
      metaByToken: new Map([[WMON, wmonMeta]]),
    });
    expect(res.send_token_list).toHaveLength(0);
    expect(res.receive_token_list).toHaveLength(0);
  });
});
