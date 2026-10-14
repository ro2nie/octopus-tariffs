import { apiGet, type FetchLike } from './client';
import { getFamilyConfig } from './families';
import { fetchProduct } from './product';
import {
	buildDaySlots,
	INTELLIGENT_GO_WINDOW,
	priceResolverFromBands,
	priceResolverFromIntervals,
	nextZonedDayStart
} from './schedule';
import type {
	DayPrices,
	OctopusProduct,
	Paginated,
	PriceInterval,
	PriceSlot,
	RegionCode,
	TariffDirection,
	TariffFamily,
	TariffInfo,
	UnitRate
} from './types';
import { startOfZonedDay, zonedDateKey, LONDON_TZ } from '#lib/utils/time';

export class PriceLookupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PriceLookupError';
	}
}

type TariffKind = 'single' | 'dual' | 'four';

interface ResolvedTariff {
	kind: TariffKind;
	tariff: TariffInfo;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RATE_PAGES = 10;

function toIso(date: Date): string {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Find the region tariff (and payment-method variant) inside a product.
 * Prefers direct-debit variants, which is what the published headline rates use.
 */
export function pickTariff(product: OctopusProduct, region: RegionCode): ResolvedTariff {
	const key = `_${region}`;
	const sources: [TariffKind, Record<string, Record<string, TariffInfo>> | undefined][] = [
		['four', product.four_rate_ev_electricity_tariffs],
		['single', product.single_register_electricity_tariffs],
		['dual', product.dual_register_electricity_tariffs]
	];

	for (const [kind, dict] of sources) {
		const paymentMethods = dict?.[key];
		if (!paymentMethods) continue;
		const tariff = paymentMethods.direct_debit_monthly ?? Object.values(paymentMethods)[0];
		if (tariff) return { kind, tariff };
	}

	throw new PriceLookupError(
		`No electricity tariff found for region "${region}" in product "${product.code}".`
	);
}

function unitRatesToIntervals(rates: readonly UnitRate[], fallbackEnd: Date): PriceInterval[] {
	return rates
		.map((rate) => ({
			start: new Date(rate.valid_from),
			end: rate.valid_to ? new Date(rate.valid_to) : fallbackEnd,
			priceIncVat: rate.value_inc_vat
		}))
		.filter((interval) => Number.isFinite(interval.priceIncVat));
}

/**
 * Fetch unit rates for a window, following the API's `next` links. Agile publishes
 * a rate for every half hour, so a multi-day window spans more than one page.
 */
async function fetchUnitRates(
	productCode: string,
	tariffCode: string,
	endpoint: 'standard-unit-rates' | 'day-unit-rates' | 'night-unit-rates',
	from: Date,
	to: Date,
	fetchFn?: FetchLike
): Promise<UnitRate[]> {
	const path =
		`/products/${encodeURIComponent(productCode)}/electricity-tariffs/${encodeURIComponent(tariffCode)}/` +
		`${endpoint}/?period_from=${toIso(from)}&period_to=${toIso(to)}`;

	const results: UnitRate[] = [];
	let next: string | null = path;

	for (let page = 0; page < MAX_RATE_PAGES && next; page++) {
		const data: Paginated<UnitRate> = await apiGet(next, { fetchFn });
		results.push(...(data.results ?? []));
		next = data.next;
	}

	return results;
}

export interface FetchDayPricesArgs {
	productCode: string;
	region: RegionCode;
	/** Which tariff family the product belongs to. Defaults to Intelligent Go. */
	family?: TariffFamily;
	/** Whether the tariff is for imported or exported electricity. Defaults to import. */
	direction?: TariffDirection;
	/** Any instant within the local day to price. Defaults to "now". */
	date?: Date;
	fetchFn?: FetchLike;
	timeZone?: string;
}

/**
 * Fetch the full day's half-hourly unit rates for a region.
 *
 * Strategy:
 *  1. Prefer the `standard-unit-rates` endpoint, which encodes either the real
 *     Intelligent Go schedule or the half-hourly Agile prices.
 *  2. For Intelligent Go only, if it returns nothing (as the newest four-rate
 *     products do), fall back to the day/night rates and derive a schedule.
 */
export async function fetchDayPrices(args: FetchDayPricesArgs): Promise<DayPrices> {
	const {
		productCode,
		region,
		family = 'intelligent-go',
		direction = 'import',
		date = new Date(),
		fetchFn,
		timeZone = LONDON_TZ
	} = args;

	const product = await fetchProduct(productCode, fetchFn);
	const { kind, tariff } = pickTariff(product, region);

	// The family's fixed cheap window drives the derived day/night fallback,
	// e.g. Intelligent Go 23:30–05:30 vs Octopus Go 00:30–05:30.
	const window = getFamilyConfig(family).window ?? INTELLIGENT_GO_WINDOW;

	const dayStart = startOfZonedDay(date, timeZone);
	const dayEnd = nextZonedDayStart(dayStart, timeZone);
	const fetchFrom = new Date(dayStart.getTime() - DAY_MS);
	const fetchTo = new Date(dayEnd.getTime() + DAY_MS);

	const scheduled = await fetchUnitRates(
		productCode,
		tariff.code,
		'standard-unit-rates',
		fetchFrom,
		fetchTo,
		fetchFn
	);

	let slots: PriceSlot[];
	let source: DayPrices['source'] = 'schedule';

	if (scheduled.length > 0) {
		const resolver = priceResolverFromIntervals(unitRatesToIntervals(scheduled, fetchTo));
		slots = buildDaySlots(date, resolver, window, timeZone);
	} else if (family === 'agile') {
		throw new PriceLookupError(`No half-hourly prices found for Agile tariff "${tariff.code}".`);
	} else {
		source = 'derived';
		const { peak, offPeak } = await resolveBandPrices(
			productCode,
			tariff,
			kind,
			fetchFrom,
			fetchTo,
			fetchFn
		);
		slots = buildDaySlots(
			date,
			priceResolverFromBands(peak, offPeak, window, timeZone),
			window,
			timeZone
		);
	}

	// Ensure every half-hour slot is priced; if the Intelligent Go schedule had
	// gaps, fill from the constant band rates so the chart is never partially empty.
	if (slots.length === 0 && family !== 'agile') {
		const { peak, offPeak } = await resolveBandPrices(
			productCode,
			tariff,
			kind,
			fetchFrom,
			fetchTo,
			fetchFn
		);
		slots = buildDaySlots(
			date,
			priceResolverFromBands(peak, offPeak, window, timeZone),
			window,
			timeZone
		);
		source = 'derived';
	}

	if (slots.length === 0) {
		throw new PriceLookupError(`No prices could be determined for tariff "${tariff.code}".`);
	}

	// Re-classify off-peak with the family's own rules: Intelligent Go uses its
	// fixed window, Agile compares each slot against the day's average price.
	const offPeakFlags = getFamilyConfig(family).classifyOffPeak(slots);
	slots = slots.map((slot, index) => ({ ...slot, offPeak: offPeakFlags[index] }));

	return {
		date: zonedDateKey(date, timeZone),
		region,
		family,
		direction,
		productCode,
		productName: product.display_name,
		tariffCode: tariff.code,
		slots,
		standingChargeIncVat: tariff.standing_charge_inc_vat ?? null,
		source,
		fetchedAt: new Date()
	};
}

async function resolveBandPrices(
	productCode: string,
	tariff: TariffInfo,
	kind: TariffKind,
	from: Date,
	to: Date,
	fetchFn?: FetchLike
): Promise<{ peak: number; offPeak: number }> {
	const flat = tariff.standard_unit_rate_inc_vat;
	if (flat != null) return { peak: flat, offPeak: flat };

	const day = tariff.day_unit_rate_inc_vat;
	const night = tariff.night_unit_rate_inc_vat;
	if (day != null && night != null) return { peak: day, offPeak: night };

	// Last resort: query the day/night endpoints directly.
	const [dayRates, nightRates] = await Promise.all([
		fetchUnitRates(productCode, tariff.code, 'day-unit-rates', from, to, fetchFn),
		fetchUnitRates(productCode, tariff.code, 'night-unit-rates', from, to, fetchFn)
	]);

	const peak = dayRates.at(0)?.value_inc_vat;
	const offPeak = nightRates.at(0)?.value_inc_vat;

	if (peak == null || offPeak == null) {
		throw new PriceLookupError(
			`Could not determine unit rates for tariff "${tariff.code}" (kind: ${kind}).`
		);
	}

	return { peak, offPeak };
}
