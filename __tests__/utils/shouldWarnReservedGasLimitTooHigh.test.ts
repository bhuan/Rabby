import { shouldWarnReservedGasLimitTooHigh } from '@/utils/gasGuards';

const MONAD_MAINNET = 143;
const MONAD_TESTNET = 10143;
const ETHEREUM = 1;

describe('shouldWarnReservedGasLimitTooHigh', () => {
  it('does not warn on non-Monad chains regardless of gas-limit ratio', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: ETHEREUM,
        gasLimit: 10_000_000,
        recommendGasLimit: 21_000,
      })
    ).toBe(false);
  });

  it('does not warn on Monad mainnet when gasLimit ≤ 10× estimate', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: MONAD_MAINNET,
        gasLimit: 21_000 * 10,
        recommendGasLimit: 21_000,
      })
    ).toBe(false);
  });

  it('warns on Monad mainnet when gasLimit > 10× estimate', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: MONAD_MAINNET,
        gasLimit: 21_000 * 10 + 1,
        recommendGasLimit: 21_000,
      })
    ).toBe(true);
  });

  it('warns on Monad testnet when gasLimit > 10× estimate', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: MONAD_TESTNET,
        gasLimit: 220_000,
        recommendGasLimit: 21_000,
      })
    ).toBe(true);
  });

  it('does not warn below the protocol minimum (21000) — would already fire gasLimitNotEnough', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: MONAD_MAINNET,
        gasLimit: 20_999,
        recommendGasLimit: 21_000,
      })
    ).toBe(false);
  });

  it('does not warn when recommend is missing (avoids divide-by-zero)', () => {
    expect(
      shouldWarnReservedGasLimitTooHigh({
        chainId: MONAD_MAINNET,
        gasLimit: 5_000_000,
        recommendGasLimit: 0,
      })
    ).toBe(false);
  });
});
