import { BalanceChange, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import openapiService from '@/background/service/openapi';
import { enrichBalanceChangePricing } from '@/background/service/localSimulation/pricing/enrich';

jest.mock('@/background/service/openapi', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(),
  },
}));

const getToken = openapiService.getToken as jest.MockedFunction<
  typeof openapiService.getToken
>;

const token = (overrides: Partial<TokenItem>): TokenItem =>
  (({
    id: 'monad',
    chain: 'monad',
    amount: 1,
    raw_amount: '1000000000000000000',
    raw_amount_hex_str: '0xde0b6b3a7640000',
    decimals: 18,
    display_symbol: 'MON',
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    logo_url: '',
    name: 'Monad',
    optimized_symbol: 'MON',
    price: 0,
    symbol: 'MON',
    time_at: 0,
    price_24h_change: 0,
    ...overrides,
  } as unknown) as TokenItem);

const balanceChange = (overrides: Partial<BalanceChange>): BalanceChange =>
  (({
    success: true,
    error: null,
    send_token_list: [],
    receive_token_list: [],
    send_nft_list: [],
    receive_nft_list: [],
    usd_value_change: 0,
    ...overrides,
  } as unknown) as BalanceChange);

describe('enrichBalanceChangePricing', () => {
  beforeEach(() => {
    getToken.mockReset();
  });

  it('uses Rabby OpenAPI pricing for mainnet and preserves simulated amounts', async () => {
    getToken.mockImplementation(async (_user, _chain, tokenId) =>
      token({
        id: tokenId,
        amount: 999,
        price: tokenId === 'monad' ? 2 : 1,
        symbol: tokenId === 'monad' ? 'MON' : 'USDC',
      })
    );

    const result = await enrichBalanceChangePricing({
      chain: { serverId: 'monad', isTestnet: false },
      userAddress: '0x0000000000000000000000000000000000000123',
      balanceChange: balanceChange({
        send_token_list: [token({ id: 'monad', amount: 2 })],
        receive_token_list: [
          token({
            id: '0x0000000000000000000000000000000000000abc',
            amount: 10,
            symbol: 'USDC',
          }),
        ],
      }),
    });

    expect(result.pricingSource).toBe('rabby-openapi');
    expect(result.balanceChange.send_token_list[0].amount).toBe(2);
    expect(result.balanceChange.send_token_list[0].price).toBe(2);
    expect(result.balanceChange.receive_token_list[0].amount).toBe(10);
    expect(result.balanceChange.receive_token_list[0].price).toBe(1);
    expect(result.balanceChange.usd_value_change).toBe(6);
  });

  it('downgrades to "none" when any token fails to price, but keeps the merged metadata', async () => {
    getToken.mockImplementation(async (_user, _chain, tokenId) => {
      if (tokenId === 'monad') {
        return token({ id: tokenId, price: 2, symbol: 'MON' });
      }
      throw new Error('no row');
    });

    const result = await enrichBalanceChangePricing({
      chain: { serverId: 'monad', isTestnet: false },
      userAddress: '0x0000000000000000000000000000000000000123',
      balanceChange: balanceChange({
        send_token_list: [token({ id: 'monad', amount: 2 })],
        receive_token_list: [
          token({
            id: '0x0000000000000000000000000000000000000abc',
            amount: 10,
            symbol: 'USDC',
          }),
        ],
      }),
    });

    expect(result.pricingSource).toBe('none');
    expect(result.balanceChange.usd_value_change).toBe(0);
    // priced token's metadata still merged
    expect(result.balanceChange.send_token_list[0].price).toBe(2);
  });

  it('does not request pricing for testnets', async () => {
    const result = await enrichBalanceChangePricing({
      chain: { serverId: 'custom_10143', isTestnet: true },
      userAddress: '0x0000000000000000000000000000000000000123',
      balanceChange: balanceChange({
        send_token_list: [token({ chain: 'custom_10143' })],
      }),
    });

    expect(result.pricingSource).toBe('none');
    expect(getToken).not.toHaveBeenCalled();
  });
});
