import { apiGet, type FetchLike } from './client';
import { getFamilyConfig } from './families';
import type { OctopusProduct, OctopusProductSummary, Paginated, TariffFamily } from './types';

const EV_SAVER_PATTERN = /ev saver/i;

const PRODUCTS_PAGE_SIZE = 100;
const MAX_PRODUCT_PAGES = 10;

export class ProductLookupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProductLookupError';
	}
}

/** True for the "EV Saver" variant, which is a distinct (usually identical) tariff. */
export function isEvSaver(product: OctopusProductSummary): boolean {
	return EV_SAVER_PATTERN.test(product.display_name);
}

/** True while a product is still open to new sign-ups. */
export function isCurrentlyAvailable(product: OctopusProductSummary): boolean {
	return product.available_to === null;
}

/** Fetch every page of the public product catalogue. */
async function fetchAllProducts(fetchFn?: FetchLike): Promise<OctopusProductSummary[]> {
	const all: OctopusProductSummary[] = [];
	let path: string | null = `/products/?brand=OCTOPUS_ENERGY&page_size=${PRODUCTS_PAGE_SIZE}`;

	for (let page = 0; page < MAX_PRODUCT_PAGES && path; page++) {
		const data: Paginated<OctopusProductSummary> = await apiGet(path, { fetchFn });
		all.push(...data.results);
		path = data.next;
	}

	return all;
}

function byAvailabilityThenNewest(a: OctopusProductSummary, b: OctopusProductSummary): number {
	if (isCurrentlyAvailable(a) !== isCurrentlyAvailable(b)) {
		return isCurrentlyAvailable(a) ? -1 : 1;
	}
	return Date.parse(b.available_from) - Date.parse(a.available_from);
}

/**
 * Discover the currently-listed import electricity products for a tariff family
 * so the user can pick the exact tariff they are on. Most recent first.
 */
export async function listTariffProducts(
	family: TariffFamily,
	fetchFn?: FetchLike
): Promise<OctopusProductSummary[]> {
	const products = await fetchAllProducts(fetchFn);
	return products.filter(getFamilyConfig(family).matches).sort(byAvailabilityThenNewest);
}

/** Discover the currently-listed Intelligent Octopus Go domestic products. */
export function listIntelligentGoProducts(fetchFn?: FetchLike): Promise<OctopusProductSummary[]> {
	return listTariffProducts('intelligent-go', fetchFn);
}

/** Discover the currently-listed classic Octopus Go domestic products. */
export function listOctopusGoProducts(fetchFn?: FetchLike): Promise<OctopusProductSummary[]> {
	return listTariffProducts('octopus-go', fetchFn);
}

/**
 * Discover the currently-listed export (outgoing) products for a family, e.g.
 * Agile Outgoing Octopus. Returns an empty list for families without one.
 */
export async function listExportProducts(
	family: TariffFamily,
	fetchFn?: FetchLike
): Promise<OctopusProductSummary[]> {
	const exportConfig = getFamilyConfig(family).export;
	if (!exportConfig) return [];

	const products = await fetchAllProducts(fetchFn);
	return products.filter(exportConfig.matches).sort(byAvailabilityThenNewest);
}

/**
 * Choose a sensible default product: the currently-available base tariff,
 * preferring non "EV Saver" variants.
 */
export function selectDefaultProduct(
	products: readonly OctopusProductSummary[]
): OctopusProductSummary | undefined {
	return (
		products.find((p) => isCurrentlyAvailable(p) && !isEvSaver(p)) ??
		products.find(isCurrentlyAvailable) ??
		products.find((p) => !isEvSaver(p)) ??
		products[0]
	);
}

/** Fetch the full product document (tariff codes, rates and standing charges). */
export async function fetchProduct(code: string, fetchFn?: FetchLike): Promise<OctopusProduct> {
	if (!code) {
		throw new ProductLookupError('A product code is required.');
	}
	return apiGet<OctopusProduct>(`/products/${encodeURIComponent(code)}/`, { fetchFn });
}
