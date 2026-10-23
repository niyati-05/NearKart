/** MongoDB duplicate-key error (E11000). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

/** The indexed field(s) that caused a duplicate-key error, when available. */
export function duplicateKeyField(error: unknown): string | null {
  if (!isDuplicateKeyError(error)) {
    return null;
  }

  const keyPattern = (error as { keyPattern?: Record<string, unknown> })
    .keyPattern;

  if (keyPattern && typeof keyPattern === 'object') {
    return Object.keys(keyPattern)[0] ?? null;
  }

  return null;
}
