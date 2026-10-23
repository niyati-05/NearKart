const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Convert integer paise from the API into a readable rupee amount. */
export function formatPaise(paise: number): string {
  return inrFormatter.format(paise / 100);
}

/** Convert paise into the value shown in a rupee text input. */
export function paiseToRupeeInput(paise: number): string {
  const value = (paise / 100).toFixed(2);
  return value.endsWith('.00') ? value.slice(0, -3) : value;
}

export interface RupeeParseResult {
  paise?: number;
  error?: string;
}

/**
 * Parse a rupee input without using floating point for the stored value.
 * Prices are always sent to the API as integer paise.
 */
export function parseRupeeInput(
  value: string,
  minimumPaise = 0,
): RupeeParseResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: 'Enter a price with up to 2 decimal places.' };
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(paise)) {
    return { error: 'Enter a valid price.' };
  }

  if (paise < minimumPaise) {
    return {
      error:
        minimumPaise >= 100
          ? 'Price must be at least ₹1.'
          : 'Price cannot be negative.',
    };
  }

  if (paise > 10_000_000) {
    return { error: 'Price must be ₹1,00,000 or less.' };
  }

  return { paise };
}
