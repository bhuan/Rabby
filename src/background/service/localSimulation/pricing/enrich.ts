import BigNumber from 'bignumber.js';
import { Chain } from '@debank/common';
import { BalanceChange, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import openapiService from '../../openapi';
import { LocalSimulationPricingSource } from '../types';

const tokenKey = (token: Pick<TokenItem, 'chain' | 'id'>) =>
  `${token.chain}:${token.id.toLowerCase()}`;

const tokenUsdValue = (token: TokenItem) =>
  new BigNumber(token.amount || 0).times(token.price || 0);

const mergePricedToken = (token: TokenItem, priced?: TokenItem): TokenItem => {
  if (!priced) return { ...token };

  const price = Number.isFinite(priced.price) ? priced.price : token.price;
  return {
    ...token,
    ...priced,
    id: token.id,
    chain: token.chain,
    amount: token.amount,
    decimals: token.decimals,
    raw_amount: token.raw_amount,
    raw_amount_hex_str: token.raw_amount_hex_str,
    display_symbol: priced.display_symbol || token.display_symbol,
    logo_url: priced.logo_url || token.logo_url,
    name: priced.name || token.name,
    optimized_symbol: priced.optimized_symbol || token.optimized_symbol,
    symbol: priced.symbol || token.symbol,
    price,
    usd_value: tokenUsdValue({ ...token, price }).toNumber(),
  };
};

export const enrichBalanceChangePricing = async ({
  chain,
  userAddress,
  balanceChange,
}: {
  chain: Pick<Chain, 'serverId' | 'isTestnet'>;
  userAddress: string;
  balanceChange: BalanceChange;
}): Promise<{
  balanceChange: BalanceChange;
  pricingSource: LocalSimulationPricingSource;
}> => {
  const tokens = [
    ...balanceChange.send_token_list,
    ...balanceChange.receive_token_list,
  ];

  if (chain.isTestnet || tokens.length === 0) {
    return {
      balanceChange,
      pricingSource: 'none',
    };
  }

  const uniqueTokens = Array.from(
    new Map(tokens.map((token) => [tokenKey(token), token])).values()
  );
  const pricedByKey = new Map<string, TokenItem>();
  let anyTokenFailed = false;

  await Promise.all(
    uniqueTokens.map(async (token) => {
      try {
        const priced = await openapiService.getToken(
          userAddress,
          chain.serverId,
          token.id
        );
        if (priced) {
          pricedByKey.set(tokenKey(token), priced);
        } else {
          anyTokenFailed = true;
        }
      } catch (e) {
        anyTokenFailed = true;
      }
    })
  );

  if (pricedByKey.size === 0) {
    return { balanceChange, pricingSource: 'none' };
  }
  // Partial-pricing all-or-nothing: if any token failed, the merge below still
  // applies (their logo/symbol from DeBank are still useful) but the USD diff
  // is suppressed and pricingSource is reported as 'none' so the caller hides
  // the misleading "+/- $X" line.

  const sendTokenList = balanceChange.send_token_list.map((token) =>
    mergePricedToken(token, pricedByKey.get(tokenKey(token)))
  );
  const receiveTokenList = balanceChange.receive_token_list.map((token) =>
    mergePricedToken(token, pricedByKey.get(tokenKey(token)))
  );
  const usdValueChange = receiveTokenList
    .reduce((acc, token) => acc.plus(tokenUsdValue(token)), new BigNumber(0))
    .minus(
      sendTokenList.reduce(
        (acc, token) => acc.plus(tokenUsdValue(token)),
        new BigNumber(0)
      )
    );

  return {
    balanceChange: {
      ...balanceChange,
      send_token_list: sendTokenList,
      receive_token_list: receiveTokenList,
      usd_value_change: anyTokenFailed ? 0 : usdValueChange.toNumber(),
    },
    pricingSource: anyTokenFailed ? 'none' : 'rabby-openapi',
  };
};
