import BigNumber from 'bignumber.js';
import { synthesizeNativeBalanceChange } from '@/background/service/localSimulation/synthesize/balanceChange';

const fakeChain = {
  id: 10143,
  serverId: 'custom_10143',
  nativeTokenAddress: 'custom_10143',
  nativeTokenSymbol: 'MON',
  nativeTokenDecimals: 18,
  nativeTokenLogo: '',
} as any;

const USER = '0x0000000000000000000000000000000000000123';

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
