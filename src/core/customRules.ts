import type { CustomRule } from '../types';
import { canStartWith, compilePattern } from './prefixMatcher';

/**
 * Custom business rules layered on top of libphonenumber. This is where the
 * logic of the legacy `international-phone-numbers.js` lives now.
 *
 * - `pattern` is tested against the **national significant number** (NSN):
 *   digits after the calling code, without trunk prefix
 *   (FR `612345678`, BJ `0197123456`).
 * - `nationalPattern` is tested against the **national number**: what is
 *   dialled locally, with the trunk prefix (FR `0612345678`).
 *
 * Mixing both up was the root cause of bug #1 of the legacy file: its regexes
 * contained the trunk `0` while `totalDigits` counted NSN digits, so 36
 * countries could never validate.
 *
 * Patterns always have to match the **whole** string (they are anchored
 * automatically).
 */

const anchoredCache = new WeakMap<RegExp, RegExp>();

/** Full-string match, safe with `g` / `y` flags. */
export function fullMatch(re: RegExp, value: string): boolean {
  let anchored = anchoredCache.get(re);
  if (!anchored) {
    anchored = new RegExp(`^(?:${re.source})$`, re.flags.replace(/[gy]/g, ''));
    anchoredCache.set(re, anchored);
  }
  return anchored.test(value);
}

export interface CustomRuleInput {
  /** National significant number. */
  nsn: string;
  /** National number with trunk prefix (digits only). */
  national: string;
}

export type CustomRuleResult =
  /** The rule accepts the complete number. */
  | 'pass'
  /** The number can still become acceptable with more digits. */
  | 'incomplete'
  /** More digits than the rule allows. */
  | 'too_long'
  /** The rule rejects the number. */
  | 'fail';

function maxRuleLength(rule: CustomRule): number | undefined {
  return rule.lengths && rule.lengths.length > 0
    ? Math.max(...rule.lengths)
    : undefined;
}

/**
 * Checks a **complete** number (possible length for the country) against a
 * rule. With `allowIncomplete`, returns `'incomplete'` instead of `'fail'`
 * when more digits could still make it pass.
 */
export function evaluateCustomRule(
  rule: CustomRule,
  input: CustomRuleInput,
  allowIncomplete = false
): CustomRuleResult {
  const max = maxRuleLength(rule);
  if (max !== undefined && input.nsn.length > max) return 'too_long';
  const lengthOk =
    !rule.lengths?.length || rule.lengths.includes(input.nsn.length);
  const patternOk = !rule.pattern || fullMatch(rule.pattern, input.nsn);
  const nationalOk =
    !rule.nationalPattern || fullMatch(rule.nationalPattern, input.national);
  if (lengthOk && patternOk && nationalOk) return 'pass';
  if (allowIncomplete && isRulePrefixViable(rule, input)) {
    if (max === undefined || input.nsn.length < max) return 'incomplete';
  }
  return 'fail';
}

/**
 * `false` when typed digits can already never satisfy the rule. Patterns our
 * prefix engine cannot parse are assumed viable.
 */
export function isRulePrefixViable(
  rule: CustomRule,
  input: CustomRuleInput
): boolean {
  const max = maxRuleLength(rule);
  if (max !== undefined && input.nsn.length > max) return false;
  if (
    rule.pattern &&
    compilePattern(rule.pattern) &&
    !canStartWith(rule.pattern, input.nsn)
  ) {
    return false;
  }
  if (
    rule.nationalPattern &&
    compilePattern(rule.nationalPattern) &&
    !canStartWith(rule.nationalPattern, input.national)
  ) {
    return false;
  }
  return true;
}

/**
 * Builds a rule accepting only NSNs starting with one of `prefixes`.
 *
 * @example
 * createPrefixRule({ prefixes: ['0196', '0197'], lengths: [10], message: 'MTN uniquement' })
 */
export function createPrefixRule(options: {
  prefixes: readonly string[];
  lengths?: number[];
  message?: string;
  description?: string;
  mode?: CustomRule['mode'];
}): CustomRule {
  const { prefixes, lengths, message, description, mode } = options;
  const alternatives = prefixes
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean)
    .join('|');
  return {
    pattern: new RegExp(`(?:${alternatives})\\d*`),
    lengths,
    message,
    description,
    mode,
  };
}

/**
 * Two-digit operator blocks of Beninese mobiles, **after** the `01` added by
 * the 2024 renumbering (`01 XX …`), as listed in the legacy
 * `international-phone-numbers.js`.
 *
 * ⚠️ Operator ranges change (new allocations, portability, Celtiis). Check
 * them against ARCEP Bénin's current numbering plan before relying on them.
 */
export const BJ_OPERATOR_PREFIXES = {
  MTN: [
    '60',
    '61',
    '62',
    '63',
    '64',
    '65',
    '66',
    '67',
    '68',
    '69',
    '96',
    '97',
    '98',
    '99',
  ],
  MOOV: [
    '40',
    '41',
    '42',
    '43',
    '44',
    '45',
    '46',
    '47',
    '48',
    '49',
    '51',
    '53',
    '55',
    '90',
    '91',
    '92',
    '93',
    '94',
    '95',
  ],
} as const;

/**
 * Example rule, **not active by default**: the `BJ` rule of the legacy file,
 * unchanged. It is tested against the national significant number, which in
 * Benin includes the leading `01` (`0197123456`).
 *
 * Enable it with `customRules={{ BJ: BJ_OPERATOR_RULE }}`.
 *
 * Note: the legacy description mentioned `55-59`, but its regex only accepts
 * `51, 53, 55, 57` in the 5x block; the regex is kept as the reference.
 * ⚠️ See `BJ_OPERATOR_PREFIXES`: ranges must be checked regularly.
 */
export const BJ_OPERATOR_RULE: CustomRule = {
  pattern: /^01(4[0-9]|5[1357]|6[0-9]|9[0-9])\d{6}$/,
  lengths: [10],
  message: 'Préfixe opérateur béninois non reconnu',
  description:
    'Commence par 01 puis un préfixe opérateur (40-49, 51, 53, 55, 57, 60-69, 90-99) et 6 chiffres. Plages à vérifier auprès de l’ARCEP Bénin.',
};
