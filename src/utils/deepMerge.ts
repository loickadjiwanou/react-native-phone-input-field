import type { DeepPartial } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Immutable deep merge of plain objects; arrays and other values replace. */
export function deepMerge<T>(
  base: T,
  ...patches: (DeepPartial<T> | undefined | null)[]
): T {
  let result: unknown = base;
  for (const patch of patches) {
    if (!patch) continue;
    result = mergeTwo(result, patch);
  }
  return result as T;
}

function mergeTwo(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch;
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === undefined) continue;
    out[key] = mergeTwo(base[key], value);
  }
  return out;
}
