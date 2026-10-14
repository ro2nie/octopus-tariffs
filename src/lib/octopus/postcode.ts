/**
 * UK postcode validation and normalisation.
 *
 * The API accepts postcodes with or without spaces and case-insensitively, but
 * we normalise for storage and formatting so the same value always hashes to
 * the same cache entry.
 */

// Based on the widely used UK government "bulk data transfer" pattern, extended
// to cover the non-geographic GIR 0AA code and BFPO-style postcodes.
const UK_POSTCODE_REGEX =
	/^(GIR ?0AA|(?:[A-PR-UWYZ][0-9]{1,2}|[A-PR-UWYZ][A-HK-Y][0-9]{1,2}|[A-PR-UWYZ][0-9][A-HJKSTUW]|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRVWXY]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

/** Remove all whitespace and upper-case, e.g. `" sw1a 1aa "` -> `"SW1A1AA"`. */
export function normalizePostcode(input: string): string {
	return input.replace(/\s+/g, '').toUpperCase();
}

/** Validate a raw user-entered postcode (spaces and case are ignored). */
export function isValidPostcode(input: string): boolean {
	return UK_POSTCODE_REGEX.test(input.trim());
}

/**
 * Return the canonical "outward inward" presentation for a valid postcode,
 * e.g. `"sw1a1aa"` -> `"SW1A 1AA"`. Invalid input is returned normalised but
 * without a space so it is never silently mangled.
 */
export function formatPostcode(input: string): string {
	const normalized = normalizePostcode(input);
	if (!isValidPostcode(normalized)) return normalized;
	return `${normalized.slice(0, -3)} ${normalized.slice(-3)}`;
}
