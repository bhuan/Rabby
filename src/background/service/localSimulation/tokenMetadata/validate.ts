const MAX_SYMBOL = 32;
const MAX_NAME = 64;
const PRINTABLE = /^[\x20-\x7E]+$/;

export const isValidSymbol = (s: unknown): s is string =>
  typeof s === 'string' &&
  s.length > 0 &&
  s.length <= MAX_SYMBOL &&
  PRINTABLE.test(s);

export const isValidName = (s: unknown): s is string =>
  typeof s === 'string' &&
  s.length > 0 &&
  s.length <= MAX_NAME &&
  PRINTABLE.test(s);

export const isValidDecimals = (d: unknown): d is number =>
  typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 30;
