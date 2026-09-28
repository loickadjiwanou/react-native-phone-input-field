import {
  canStartWith,
  compilePattern,
} from 'react-native-phone-input-field/core';

describe('prefix matcher', () => {
  it('handles the metadata syntax', () => {
    const p = compilePattern('(?:01\\d|8)\\d{7}')!;
    expect(p.canStartWith('')).toBe(true);
    expect(p.canStartWith('01')).toBe(true);
    expect(p.canStartWith('8')).toBe(true);
    expect(p.canStartWith('9')).toBe(false);
    expect(p.canStartWith('02')).toBe(false);
    expect(p.matches('0197123456')).toBe(true);
    expect(p.matches('019712345')).toBe(false);
    expect(p.canStartWith('01971234567')).toBe(false);
  });

  it('supports classes, ranges, negation, quantifiers and anchors', () => {
    expect(compilePattern('^[1-9]\\d{8}$')!.matches('612345678')).toBe(true);
    expect(compilePattern('[^0]\\d')!.canStartWith('0')).toBe(false);
    expect(compilePattern('[^0]\\d')!.canStartWith('5')).toBe(true);
    expect(compilePattern('1\\d{2,}')!.matches('1234567')).toBe(true);
    expect(compilePattern('1\\d{2,}')!.matches('12')).toBe(false);
    expect(compilePattern('12*3+')!.matches('1333')).toBe(true);
    expect(compilePattern('12*3+')!.matches('12223')).toBe(true);
    expect(compilePattern('1(2|3)?4')!.matches('14')).toBe(true);
    expect(compilePattern('1.?4')!.matches('174')).toBe(true);
    expect(compilePattern('1\\d+?')!.matches('1234')).toBe(true);
    expect(compilePattern('[\\d]')!.matches('7')).toBe(true);
    expect(compilePattern('[0\\-5]')!.matches('5')).toBe(true);
    expect(compilePattern('[5-]')!.matches('5')).toBe(true);
    expect(compilePattern('\\-?1')!.matches('1')).toBe(true);
    expect(compilePattern('a1')!.canStartWith('1')).toBe(false);
    expect(compilePattern('(1)(2)')!.matches('12')).toBe(true);
    expect(compilePattern(/^01(?:4[0-5])\d{6}$/)!.canStartWith('0146')).toBe(
      false
    );
  });

  it('generates samples', () => {
    const p = compilePattern('[2-9]\\d{3}')!;
    expect(p.sample(4)).toBe('2000');
    expect(p.sample(3)).toBeNull();
    expect(compilePattern('1{2}')!.sample(2)).toBe('11');
  });

  it('returns null on unsupported syntax, and canStartWith is then permissive', () => {
    for (const bad of [
      '(?=1)',
      '\\w',
      '1{3,1}',
      '(1',
      '1)',
      '[3-1]',
      '*1',
      '1{a}',
      '(?!2)',
      '1{99}',
    ]) {
      expect(compilePattern(bad)).toBeNull();
    }
    expect(canStartWith('\\w', '1')).toBe(true);
    expect(canStartWith('1', '2')).toBe(false);
  });

  it('caches compiled patterns', () => {
    expect(compilePattern('123')).toBe(compilePattern('123'));
    expect(compilePattern('(?=1)')).toBe(compilePattern('(?=1)'));
  });

  it('never matches non-digit input', () => {
    expect(compilePattern('\\d')!.canStartWith('a')).toBe(false);
  });
});
