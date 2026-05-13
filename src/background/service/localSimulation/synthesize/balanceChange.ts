import BigNumber from 'bignumber.js';
import { BalanceChange, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@debank/common';
import { NativeDelta } from '../decode/nativeDelta';

const buildNativeToken = (chain: Chain, rawAmount: BigNumber): TokenItem => {
  const decimals = chain.nativeTokenDecimals || 18;
  const amount = rawAmount
    .abs()
    .div(new BigNumber(10).pow(decimals))
    .toNumber();
  return {
    id: chain.nativeTokenAddress || chain.serverId,
    chain: chain.serverId,
    amount,
    raw_amount: rawAmount.abs().toFixed(0),
    raw_amount_hex_str: `0x${new BigNumber(rawAmount.abs().toFixed(0)).toString(
      16
    )}`,
    decimals,
    display_symbol: chain.nativeTokenSymbol,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    logo_url: chain.nativeTokenLogo || '',
    name: chain.nativeTokenSymbol,
    optimized_symbol: chain.nativeTokenSymbol,
    price: 0,
    symbol: chain.nativeTokenSymbol,
    time_at: 0,
    price_24h_change: 0,
  };
};

const baseChange = (
  error: { code: number; msg: string } | null
): BalanceChange =>
  (({
    success: error === null,
    error,
    send_token_list: [],
    receive_token_list: [],
    send_nft_list: [],
    receive_nft_list: [],
    usd_value_change: 0,
  } as unknown) as BalanceChange);

const emptyChange = () => baseChange(null);

export const synthesizeFailedBalanceChange = ({
  code,
  msg,
}: {
  code: number;
  msg: string;
}): BalanceChange => baseChange({ code, msg });

export const synthesizeNativeBalanceChange = ({
  chain,
  userAddress,
  txValue,
  txTo,
  deltas,
}: {
  chain: Chain;
  userAddress: string;
  txValue: string;
  txTo: string;
  deltas: NativeDelta[];
}): BalanceChange | null => {
  const user = userAddress.toLowerCase();
  const userDelta = deltas.find((d) => d.address === user);
  if (!userDelta) return null;

  const change = emptyChange();
  // Trace balance deltas can include gas accounting; show the signed transfer value.
  const value = new BigNumber(txValue && txValue !== '0x' ? txValue : 0);
  if (!value.gt(0)) return change;

  const to = txTo.toLowerCase();
  change.send_token_list = [buildNativeToken(chain, value)];
  if (user === to) {
    change.receive_token_list = [buildNativeToken(chain, value)];
  }
  return change;
};
