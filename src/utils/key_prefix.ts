export const MAX_KEY_LENGTH = 100;

const VALID_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Returns an error message when the prefix cannot be used in a key, otherwise null. */
export function validateKeyPrefix(
  prefix: string | null | undefined,
): string | null {
  if (prefix === null || prefix === undefined) return null;
  if (prefix === "") return "keyPrefix must not be empty";
  if (!VALID_KEY_PATTERN.test(prefix)) {
    return `keyPrefix "${prefix}" is invalid: only letters, numbers, periods, hyphens, and underscores are allowed`;
  }
  if (prefix.length >= MAX_KEY_LENGTH) {
    return `keyPrefix is ${prefix.length} characters; keys are limited to ${MAX_KEY_LENGTH}`;
  }
  return null;
}

/** Prepends the prefix unless the value already starts with it. */
export function applyKeyPrefix(
  value: string,
  prefix: string | null | undefined,
): string {
  if (!prefix || value.startsWith(prefix)) return value;
  return `${prefix}${value}`;
}

/**
 * Lists the final destination keys that would exceed the key length limit.
 * `conflictPrefix` is checked as well, since it stacks in front of the key
 * prefix when a collision is resolved with the prefix action.
 */
export function findOverlongKeys(
  keys: Iterable<string>,
  keyPrefix: string | null | undefined,
  conflictPrefix?: string | null,
): Array<{ sourceKey: string; destKey: string }> {
  const overlong: Array<{ sourceKey: string; destKey: string }> = [];
  for (const sourceKey of keys) {
    const prefixed = applyKeyPrefix(sourceKey, keyPrefix);
    const worstCase = conflictPrefix
      ? `${conflictPrefix}${prefixed}`
      : prefixed;
    if (worstCase.length > MAX_KEY_LENGTH) {
      overlong.push({ sourceKey, destKey: worstCase });
    }
  }
  return overlong;
}

interface ReferenceSets {
  flagKeys: ReadonlySet<string>;
  segmentKeys: ReadonlySet<string>;
  keyPrefix: string | null | undefined;
  /** Source key -> final destination key, for resources renamed by conflict resolution. */
  resolved?: ReadonlyMap<string, string>;
}

/**
 * Rewrites flag prerequisites and segmentMatch clause values in a rules array
 * or prerequisites array so they point at the prefixed destination keys.
 * Only keys that are part of the migration are rewritten.
 */
export function remapPrerequisites<T extends { key?: string }>(
  prerequisites: T[],
  { flagKeys, keyPrefix, resolved }: Pick<
    ReferenceSets,
    "flagKeys" | "keyPrefix" | "resolved"
  >,
): T[] {
  return prerequisites.map((p) =>
    p?.key && flagKeys.has(p.key)
      ? { ...p, key: resolved?.get(p.key) ?? applyKeyPrefix(p.key, keyPrefix) }
      : p
  );
}

export function remapRuleSegmentReferences<T extends { clauses: unknown[] }>(
  rules: T[],
  { segmentKeys, keyPrefix, resolved }: Pick<
    ReferenceSets,
    "segmentKeys" | "keyPrefix" | "resolved"
  >,
): T[] {
  return rules.map((rule) => ({
    ...rule,
    clauses: rule.clauses.map((c) => {
      const clause = c as { op?: string; values?: unknown[] };
      if (clause.op !== "segmentMatch" || !Array.isArray(clause.values)) {
        return c;
      }
      return {
        ...clause,
        values: clause.values.map((v) =>
          typeof v === "string" && segmentKeys.has(v)
            ? resolved?.get(v) ?? applyKeyPrefix(v, keyPrefix)
            : v
        ),
      };
    }),
  }));
}
