import BigNumber from 'bignumber.js';

// Chains that bill the *reserved* gasLimit instead of refunding the unused
// portion. On Monad, the unused gas is deadweight — the user pays for it
// but no one receives it, and the reserved gas also occupies block capacity
// that could have served other transactions. Explicit allowlist (not
// inferred from SAFE_GAS_LIMIT_RATIO) so a future low-ratio chain doesn't
// accidentally inherit Monad's overspend warning.
const CHAINS_BILL_RESERVED_GAS = new Set<string>(['143', '10143']);

// Trigger the alert when the user's manual gasLimit exceeds the network's
// gas estimate by more than this factor.
export const GAS_OVERSPEND_WARN_MULTIPLIER = 10;

export const shouldWarnReservedGasLimitTooHigh = ({
  chainId,
  gasLimit,
  recommendGasLimit,
}: {
  chainId: number | string;
  gasLimit: number | string | BigNumber;
  recommendGasLimit: number | string | BigNumber;
}) => {
  if (!CHAINS_BILL_RESERVED_GAS.has(String(chainId))) return false;

  const estimate = new BigNumber(recommendGasLimit);
  if (!estimate.gt(0) || new BigNumber(gasLimit).lt(21000)) return false;

  return new BigNumber(gasLimit).gt(
    estimate.times(GAS_OVERSPEND_WARN_MULTIPLIER)
  );
};
