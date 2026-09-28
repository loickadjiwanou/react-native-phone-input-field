import type { Country } from '../types';
import { COUNTRY_ALIASES } from './countries';
import { getCountriesForCallingCode } from './metadata';
import { normalizeSearchText } from './normalize';

/** Relevance tiers, best first. */
const Rank = {
  Exact: 0,
  WordStart: 1,
  Contains: 2,
  None: 3,
} as const;
type Rank = (typeof Rank)[keyof typeof Rank];

interface SearchIndexEntry {
  country: Country;
  names: string[];
  iso: string;
  callingCode: string;
  /** Main country of its calling code (US for +1, RU for +7…). */
  isMainForCallingCode: boolean;
}

function rankText(text: string, query: string): Rank {
  if (text === query) return Rank.Exact;
  if (text.startsWith(query)) return Rank.WordStart;
  if (text.includes(` ${query}`)) return Rank.WordStart;
  if (text.includes(query)) return Rank.Contains;
  return Rank.None;
}

/** Pre-computes normalized search keys; build once per country list. */
export function buildSearchIndex(
  countries: readonly Country[]
): SearchIndexEntry[] {
  return countries.map((country) => ({
    country,
    names: [
      country.name,
      country.englishName,
      ...(COUNTRY_ALIASES[country.iso2] ?? []),
    ].map(normalizeSearchText),
    iso: country.iso2.toLowerCase(),
    callingCode: country.callingCode,
    isMainForCallingCode:
      getCountriesForCallingCode(country.callingCode)[0] === country.iso2,
  }));
}

function rankEntry(
  entry: SearchIndexEntry,
  query: string,
  digits: string | null
): Rank {
  if (digits !== null) {
    // "229", "+229", "00229": match on calling code.
    if (entry.callingCode === digits) return Rank.Exact;
    if (entry.callingCode.startsWith(digits)) return Rank.WordStart;
    return Rank.None;
  }
  let best: Rank = Rank.None;
  if (query.length <= 3 && entry.iso === query) best = Rank.Exact;
  for (const name of entry.names) {
    const r = rankText(name, query);
    if (r < best) best = r;
    if (best === Rank.Exact) break;
  }
  return best;
}

/**
 * Searches countries by localized name, English name, ISO code, calling code
 * (`229`, `+229`, `00229`) and aliases (`USA`, `UK`, `RDC`, `Dahomey`…).
 * Accent- and case-insensitive. Results: exact match, then word start, then
 * substring; ties keep the input order (alphabetical).
 */
export function searchCountries(
  index: readonly SearchIndexEntry[],
  rawQuery: string
): Country[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return index.map((e) => e.country);
  const numeric = /^(\+|00)?\s*\d[\d\s]*$/.test(trimmed);
  const digits = numeric
    ? trimmed.replace(/\s/g, '').replace(/^\+/, '').replace(/^00/, '')
    : null;
  const query = normalizeSearchText(trimmed);
  if (!query && digits === null) return index.map((e) => e.country);

  const buckets: Country[][] = [[], [], []];
  for (const entry of index) {
    const rank = rankEntry(entry, query, digits);
    if (rank === Rank.None) continue;
    // "+1" → United States before Anguilla, "+7" → Russia before Kazakhstan.
    if (rank === Rank.Exact && digits !== null && entry.isMainForCallingCode) {
      buckets[rank]!.unshift(entry.country);
    } else {
      buckets[rank]!.push(entry.country);
    }
  }
  return buckets.flat();
}
