import { useDeferredValue, useMemo, useState } from 'react';

import { buildSearchIndex, searchCountries } from '../core/search';
import type { Country } from '../types';

export interface UseCountrySearchResult {
  query: string;
  setQuery: (query: string) => void;
  /** Filtered countries, best matches first. */
  results: Country[];
  /** `true` while the query is not empty. */
  isSearching: boolean;
}

/**
 * Instant, accent-insensitive country search (name, English name, ISO code,
 * calling code, aliases). The index is built once per country list.
 */
export function useCountrySearch(
  countries: readonly Country[]
): UseCountrySearchResult {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const index = useMemo(() => buildSearchIndex(countries), [countries]);
  const results = useMemo(
    () => searchCountries(index, deferredQuery),
    [index, deferredQuery]
  );
  return { query, setQuery, results, isSearching: query.trim().length > 0 };
}
