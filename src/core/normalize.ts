/**
 * Input normalization: non-Latin digits, invisible characters, separators.
 */

/** Unicode blocks whose digits 0-9 are contiguous code points. */
const DIGIT_ZEROS = [
  0x0660, // Arabic-Indic ٠-٩
  0x06f0, // Extended Arabic-Indic (Persian, Urdu) ۰-۹
  0x07c0, // NKo
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0x0ed0, // Lao
  0x0f20, // Tibetan
  0x1040, // Myanmar
  0x17e0, // Khmer
  0x1810, // Mongolian
  0xff10, // Fullwidth ０-９
];

const PLUS_SIGNS = /[+＋➕]/;

/** Converts every supported digit script to ASCII digits. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    let replaced = false;
    for (const zero of DIGIT_ZEROS) {
      if (code >= zero && code <= zero + 9) {
        out += String(code - zero);
        replaced = true;
        break;
      }
    }
    if (!replaced) out += ch;
  }
  return out;
}

/** Keeps ASCII digits only (after normalization). */
export function extractDigits(input: string): string {
  return normalizeDigits(input).replace(/\D/g, '');
}

export interface SanitizedInput {
  /** The number starts with a `+` (international format). */
  hasPlus: boolean;
  /** ASCII digits, in order. */
  digits: string;
  /** The input contains letters or symbols that are not phone separators. */
  hasInvalidChars: boolean;
}

/**
 * Characters people commonly type or paste inside phone numbers:
 * spaces (incl. NBSP / narrow NBSP), dashes of all kinds, dots, slashes,
 * parentheses, bidi / zero-width marks.
 */
const SEPARATORS = new RegExp(
  [
    '[',
    '\\s\\u00A0\\u2007\\u202F', // spaces, NBSP, figure space, narrow NBSP
    '\\-\\u2010-\\u2015\\u2212', // hyphen-minus, dashes, minus sign
    './()\\[\\]', // dots, slashes, brackets
    '\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF', // zero-width & bidi marks
    ']',
  ].join(''),
  'g'
);

/**
 * Splits raw input into a `+` flag and digits.
 *
 * `(+33) 6 12…` → `{ hasPlus: true, digits: '33612…' }`.
 * A `+` only counts when no digit precedes it.
 */
export function sanitizePhoneInput(input: string): SanitizedInput {
  const normalized = normalizeDigits(input);
  let hasPlus = false;
  let digits = '';
  let hasInvalidChars = false;
  const rest = normalized.replace(SEPARATORS, '');
  for (const ch of rest) {
    if (ch >= '0' && ch <= '9') {
      digits += ch;
    } else if (PLUS_SIGNS.test(ch)) {
      if (digits.length === 0) hasPlus = true;
      else hasInvalidChars = true;
    } else {
      hasInvalidChars = true;
    }
  }
  return { hasPlus, digits, hasInvalidChars };
}

/**
 * Case- and accent-insensitive key for search: `"Côte d’Ivoire"` →
 * `"cote divoire"`.
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Counts ASCII digits in `text` before index `end`. */
export function countDigitsBefore(text: string, end: number): number {
  let count = 0;
  for (let i = 0; i < end && i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch >= '0' && ch <= '9') count += 1;
  }
  return count;
}

/**
 * Index in `text` right after its `digitCount`-th digit (0 → before the
 * first digit, or 0 when there is none).
 */
export function caretAfterDigits(text: string, digitCount: number): number {
  if (digitCount <= 0) {
    // Keep the caret after a leading "+" if any.
    return text.startsWith('+') ? 1 : 0;
  }
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch >= '0' && ch <= '9') {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return text.length;
}
