import { apiGet, type FetchLike } from './client';
import { fetchProduct } from './product';
import {
	buildDaySlots,
	priceResolverFromBands,
	priceResolverFromIntervals,
	nextZonedDayStart
} from './schedule';
import type {
	DayPrices,
	OctopusProduct,
	PriceInterval,
	RegionCode,
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
	const data = await apiGet<{ results: UnitRate[] }>(path, { fetchFn });
	return data.results ?? [];
}

export interface FetchDayPricesArgs {
	productCode: string;
	region: RegionCode;
	/** Any instant within the local day to price. Defaults to "now". */
	date?: Date;
	fetchFn?: FetchLike;
	timeZone?: string;
}

/**
 * Fetch the full day's half-hourly unit rates for a region.
 *
 * Strategy:
 *  1. Prefer the `standard-unit-rates` endpoint, which for Intelligent Go
 *     products encodes the real peak/off-peak schedule.
 *  2. If it returns nothing (as the newest four-rate products do), fall back to
 *     the day/night rates and derive the schedule from the published window.
 */
export async function fetchDayPrices(args: FetchDayPricesArgs): Promise<DayPrices> {
	const { productCode, region, date = new Date(), fetchFn, timeZone = LONDON_TZ } = args;

	const product = await fetchProduct(productCode, fetchFn);
	const { kind, tariff } = pickTariff(product, region);

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

	let slots;
	let source: DayPrices['source'];

	if (scheduled.length > 0) {
		source = 'schedule';
		const resolver = priceResolverFromIntervals(unitRatesToIntervals(scheduled, fetchTo));
		slots = buildDaySlots(date, resolver, timeZone);
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
		slots = buildDaySlots(date, priceResolverFromBands(peak, offPeak, timeZone), timeZone);
	}

	// Ensure every half-hour slot is priced; if the schedule had gaps, fill from
	// the constant band rates so the chart is never partially empty.
	if (slots.length === 0) {
		const { peak, offPeak } = await resolveBandPrices(
			productCode,
			tariff,
			kind,
			fetchFrom,
			fetchTo,
			fetchFn
		);
		slots = buildDaySlots(date, priceResolverFromBands(peak, offPeak, timeZone), timeZone);
		source = 'derived';
	}

	return {
		date: zonedDateKey(date, timeZone),
		region,
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
