import {
  isValidDecimals,
  isValidName,
  isValidSymbol,
} from '@/background/service/localSimulation/tokenMetadata/validate';

describe('token metadata validation', () => {
  it('accepts normal ASCII symbols', () => {
    expect(isValidSymbol('WMON')).toBe(true);
    expect(isValidSymbol('USDC')).toBe(true);
    expect(isValidSymbol('aUSDC.e')).toBe(true);
  });

  it('rejects empty / oversized / non-printable symbols', () => {
    expect(isValidSymbol('')).toBe(false);
    expect(isValidSymbol('a'.repeat(33))).toBe(false);
    expect(isValidSymbol('hello\x00world')).toBe(false);
    expect(isValidSymbol('💩')).toBe(false);
    expect(isValidSymbol(undefined)).toBe(false);
    expect(isValidSymbol(123 as unknown)).toBe(false);
  });

  it('accepts plausible decimals (0..30)', () => {
    expect(isValidDecimals(0)).toBe(true);
    expect(isValidDecimals(6)).toBe(true);
    expect(isValidDecimals(18)).toBe(true);
    expect(isValidDecimals(30)).toBe(true);
  });

  it('rejects non-integer / out-of-range decimals', () => {
    expect(isValidDecimals(-1)).toBe(false);
    expect(isValidDecimals(31)).toBe(false);
    expect(isValidDecimals(1.5)).toBe(false);
    expect(isValidDecimals('18' as unknown)).toBe(false);
    expect(isValidDecimals(undefined)).toBe(false);
  });

  it('accepts and rejects names with the right bounds', () => {
    expect(isValidName('Wrapped MON')).toBe(true);
    expect(isValidName('a'.repeat(64))).toBe(true);
    expect(isValidName('a'.repeat(65))).toBe(false);
    expect(isValidName('')).toBe(false);
  });
});
