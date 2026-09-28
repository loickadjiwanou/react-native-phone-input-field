import { AsYouType, type CountryCode } from 'libphonenumber-js/core';

import type { NumberType } from '../types';
import { getMetadata, getNumberingPlan } from './metadata';
import { canStartWith, compilePattern } from './prefixMatcher';

/**
 * National significant number of a (possibly incomplete) national input, as
 * libphonenumber's as-you-type engine sees it: FR `0612` → `612`,
 * BJ `0197` → `0197` (the `01` is part of the number).
 */
export function extractNationalSignificantNumber(
  nationalDigits: string,
  country: CountryCode
): string {
  if (!nationalDigits) return '';
  // `getNationalNumber` exists at runtime but is missing from the typings.
  const formatter = new AsYouType(country, getMetadata()) as AsYouType & {
    getNationalNumber(): string;
  };
  formatter.input(nationalDigits);
  return formatter.getNationalNumber() || '';
}

/**
 * Candidates for the national significant number: the digits as typed and
 * with the trunk prefix removed. Checking both avoids false errors while the
 * engine cannot yet tell whether a leading `0` is a trunk prefix (BJ `01…`)
 * or not (FR `06…`).
 */
export function nsnCandidates(
  nationalDigits: string,
  country: CountryCode
): string[] {
  const stripped = extractNationalSignificantNumber(nationalDigits, country);
  const prefix = getNumberingPlan(country).nationalPrefix;
  const out = [nationalDigits];
  const add = (candidate: string) => {
    // An empty NSN is only plausible when the user typed (part of) the
    // trunk prefix itself: FR "0" yes, FR "00" no.
    if (!candidate && !(prefix && prefix.startsWith(nationalDigits))) return;
    if (!out.includes(candidate)) out.push(candidate);
  };
  if (stripped !== nationalDigits) add(stripped);
  if (prefix && nationalDigits.startsWith(prefix))
    add(nationalDigits.slice(prefix.length));
  return out;
}

function anyViable(patterns: string[], candidates: string[]): boolean {
  if (patterns.length === 0) return true;
  // Unsupported syntax → assume viable (never show a false error).
  if (patterns.some((p) => compilePattern(p) === null)) return true;
  return candidates.some((c) => patterns.some((p) => canStartWith(p, c)));
}

/**
 * `false` when no valid number of `country` can start with these digits.
 * Empty input is always viable.
 */
export function isViableNationalPrefix(
  nationalDigits: string,
  country: CountryCode
): boolean {
  if (!nationalDigits) return true;
  const { nationalNumberPattern } = getNumberingPlan(country);
  return anyViable(
    [nationalNumberPattern],
    nsnCandidates(nationalDigits, country)
  );
}

/** Patterns of the requested types (FIXED_LINE_OR_MOBILE expands to both). */
export function patternsForTypes(
  country: CountryCode,
  types: readonly NumberType[]
): string[] {
  const plan = getNumberingPlan(country);
  const wanted = new Set<string>();
  for (const t of types) {
    if (t === 'FIXED_LINE_OR_MOBILE') {
      wanted.add('MOBILE');
      wanted.add('FIXED_LINE');
    } else {
      wanted.add(t);
    }
  }
  const patterns: string[] = [];
  for (const t of wanted) {
    const p = plan.typePattern(t);
    if (p) patterns.push(p);
  }
  return patterns;
}

/**
 * `false` when these digits cannot start any number of the allowed types.
 * Returns `true` when the metadata has no type information.
 */
export function isViableForTypes(
  nationalDigits: string,
  country: CountryCode,
  types: readonly NumberType[]
): boolean {
  if (!nationalDigits || types.length === 0) return true;
  const patterns = patternsForTypes(country, types);
  if (patterns.length === 0) {
    // Countries such as US only define FIXED_LINE (numbers are
    // FIXED_LINE_OR_MOBILE): fall back to the fixed-line pattern for MOBILE.
    const fixed = getNumberingPlan(country).typePattern('FIXED_LINE');
    if (!fixed) return true;
    return anyViable([fixed], nsnCandidates(nationalDigits, country));
  }
  return anyViable(patterns, nsnCandidates(nationalDigits, country));
}

/** Longest possible national significant number for the country. */
export function maxPossibleLength(country: CountryCode): number {
  const lengths = getNumberingPlan(country).possibleLengths;
  return lengths.length ? Math.max(...lengths) : 17;
}
