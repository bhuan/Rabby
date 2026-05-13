// Standalone module — no chain-registry imports — so utilities can read
// these values from unit tests without booting the full @/constant barrel.

export const DEFAULT_GAS_LIMIT_RATIO = 1.5;

export const SAFE_GAS_LIMIT_RATIO: Record<string | number, number> = {
  '1284': 2,
  '1285': 2,
  '1287': 2,
  // Monad bills the reserved gasLimit — unused gas is deadweight (the user
  // pays for it, no one receives it) and also counts against block capacity.
  // Its RPC already pads eth_estimateGas by ~25-30 %; 1.075 keeps a small
  // safety margin without billing the user for unused gas.
  '143': 1.075,
  '10143': 1.075,
};

export const SAFE_GAS_LIMIT_BUFFER: Record<string | number, number> = {
  '996': 0.86,
  '49088': 0.86,
  '3068': 0.86,
};

export const DEFAULT_GAS_LIMIT_BUFFER = 0.95;
