import { apiGet, type FetchLike } from './client';
import { normalizePostcode } from './postcode';
import { REGION_CODES, type GridSupplyPoint, type Paginated, type RegionCode } from './types';

export class RegionLookupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RegionLookupError';
	}
}

function isRegionCode(value: string): value is RegionCode {
	return (REGION_CODES as readonly string[]).includes(value);
}

/**
 * Resolve a UK postcode to its electricity distribution region code (the same
 * letter that appears as the suffix of an Octopus tariff code).
 *
 * Uses the public `grid-supply-points` endpoint, which maps a postcode to a
 * GSP group such as `_C`. No authentication is required.
 */
export async function getRegionForPostcode(
	postcode: string,
	fetchFn?: FetchLike
): Promise<RegionCode> {
	const normalized = normalizePostcode(postcode);
	if (!normalized) {
		throw new RegionLookupError('A postcode is required to find your region.');
	}

	const data = await apiGet<Paginated<GridSupplyPoint>>(
		`/industry/grid-supply-points/?postcode=${encodeURIComponent(normalized)}`,
		{ fetchFn }
	);

	if (!data.results?.length) {
		throw new RegionLookupError(`No distribution region found for postcode "${postcode}".`);
	}

	const region = data.results[0].group_id.replace(/^_/, '');
	if (!isRegionCode(region)) {
		throw new RegionLookupError(
			`Unexpected region code "${region}" returned for postcode "${postcode}".`
		);
	}

	return region;
}
