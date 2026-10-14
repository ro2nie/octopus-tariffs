import { describe, expect, it } from 'vitest';
import { PriceLookupError, fetchDayPrices, pickTariff } from './prices';
import { createFetchMock } from '../../test/fetch';
import type { OctopusProduct } from './types';

const REGION = 'C' as const;
const DATE = new Date('2026-01-15T12:00:00Z');

const SCHEDULE_PRODUCT: OctopusProduct = {
	code: 'INTELLI-FIX-12M-26-04-18',
	full_name: 'Intelligent Octopus Go 12M Fixed',
	display_name: 'Intelligent Octopus Go 12M Fixed',
	is_variable: false,
	is_business: false,
	is_green: false,
	available_from: '2026-04-18T00:00:00+01:00',
	available_to: '2026-06-13T00:00:00+01:00',
	single_register_electricity_tariffs: {
		_C: {
			direct_debit_monthly: {
				code: 'E-1R-INTELLI-FIX-12M-26-04-18-C',
				standing_charge_inc_vat: 53.4,
				links: []
			}
		}
	}
};

const SCHEDULE_RATES = {
	count: 3,
	results: [
		{
			value_inc_vat: 32,
			value_exc_vat: 30.47,
			valid_from: '2026-01-15T05:30:00Z',
			valid_to: '2026-01-15T23:30:00Z',
			payment_method: null
		},
		{
			value_inc_vat: 8,
			value_exc_vat: 7.61,
			valid_from: '2026-01-15T23:30:00Z',
			valid_to: null,
			payment_method: null
		},
		{
			value_inc_vat: 8,
			value_exc_vat: 7.61,
			valid_from: '2026-01-14T23:30:00Z',
			valid_to: '2026-01-15T05:30:00Z',
			payment_method: null
		}
	]
};

const FOUR_RATE_PRODUCT: OctopusProduct = {
	code: 'IOG-SMB-FIX-12M-26-10-14',
	full_name: 'Intelligent Octopus Go 12M Fixed',
	display_name: 'Intelligent Octopus Go 12M Fixed',
	is_variable: false,
	is_business: false,
	is_green: false,
	available_from: '2026-10-14T00:00:00+01:00',
	available_to: null,
	four_rate_ev_electricity_tariffs: {
		_C: {
			direct_debit_monthly: {
				code: 'E-1R-IOG-SMB-FIX-12M-26-10-14-C',
				standing_charge_inc_vat: 53.42,
				day_unit_rate_inc_vat: 39.29,
				night_unit_rate_inc_vat: 8,
				links: []
			}
		}
	}
};

describe('pickTariff', () => {
	it('finds a single-register tariff for the region', () => {
		const result = pickTariff(SCHEDULE_PRODUCT, REGION);
		expect(result.kind).toBe('single');
		expect(result.tariff.code).toBe('E-1R-INTELLI-FIX-12M-26-04-18-C');
	});

	it('prefers the four-rate tariff when present', () => {
		const result = pickTariff(FOUR_RATE_PRODUCT, REGION);
		expect(result.kind).toBe('four');
	});

	it('throws when the region has no tariff', () => {
		expect(() => pickTariff(SCHEDULE_PRODUCT, 'N')).toThrow(PriceLookupError);
	});
});

describe('fetchDayPrices', () => {
	it('builds half-hour slots from the published schedule', async () => {
		const { fetchFn } = createFetchMock({
			'standard-unit-rates': SCHEDULE_RATES,
			'/products/INTELLI-FIX-12M-26-04-18/': SCHEDULE_PRODUCT
		});

		const prices = await fetchDayPrices({
			productCode: 'INTELLI-FIX-12M-26-04-18',
			region: REGION,
			date: DATE,
			fetchFn
		});

		expect(prices.source).toBe('schedule');
		expect(prices.date).toBe('2026-01-15');
		expect(prices.tariffCode).toBe('E-1R-INTELLI-FIX-12M-26-04-18-C');
		expect(prices.standingChargeIncVat).toBe(53.4);
		expect(prices.slots).toHaveLength(48);

		const midnight = prices.slots.find(
			(s) => s.start.toISOString() === '2026-01-15T00:00:00.000Z'
		)!;
		expect(midnight.priceIncVat).toBe(8);
		expect(midnight.offPeak).toBe(true);

		const midday = prices.slots.find((s) => s.start.toISOString() === '2026-01-15T12:00:00.000Z')!;
		expect(midday.priceIncVat).toBe(32);
		expect(midday.offPeak).toBe(false);
	});

	it('derives slots from day/night rates when no schedule is published', async () => {
		const { fetchFn } = createFetchMock({
			'standard-unit-rates': { count: 0, results: [] },
			'day-unit-rates': { count: 0, results: [] },
			'night-unit-rates': { count: 0, results: [] },
			'/products/IOG-SMB-FIX-12M-26-10-14/': FOUR_RATE_PRODUCT
		});

		const prices = await fetchDayPrices({
			productCode: 'IOG-SMB-FIX-12M-26-10-14',
			region: REGION,
			date: DATE,
			fetchFn
		});

		expect(prices.source).toBe('derived');
		const peak = prices.slots.find((s) => s.start.toISOString() === '2026-01-15T12:00:00.000Z')!;
		const offPeak = prices.slots.find((s) => s.start.toISOString() === '2026-01-15T23:30:00.000Z')!;
		expect(peak.priceIncVat).toBe(39.29);
		expect(offPeak.priceIncVat).toBe(8);
	});

	it('falls back to the day/night endpoints when rates are absent from the product', async () => {
		const product: OctopusProduct = {
			...FOUR_RATE_PRODUCT,
			four_rate_ev_electricity_tariffs: {
				_C: {
					direct_debit_monthly: {
						code: 'E-1R-IOG-SMB-FIX-12M-26-10-14-C',
						standing_charge_inc_vat: 53.42,
						links: []
					}
				}
			}
		};

		const { fetchFn } = createFetchMock({
			'standard-unit-rates': { count: 0, results: [] },
			'day-unit-rates': {
				count: 1,
				results: [{ value_inc_vat: 40, valid_from: '2026-01-01T00:00:00Z', valid_to: null }]
			},
			'night-unit-rates': {
				count: 1,
				results: [{ value_inc_vat: 9, valid_from: '2026-01-01T00:00:00Z', valid_to: null }]
			},
			'/products/IOG-SMB-FIX-12M-26-10-14/': product
		});

		const prices = await fetchDayPrices({
			productCode: 'IOG-SMB-FIX-12M-26-10-14',
			region: REGION,
			date: DATE,
			fetchFn
		});

		const peak = prices.slots.find((s) => s.start.toISOString() === '2026-01-15T12:00:00.000Z')!;
		expect(peak.priceIncVat).toBe(40);
	});

	it('throws when no rates can be determined', async () => {
		const product: OctopusProduct = {
			...FOUR_RATE_PRODUCT,
			four_rate_ev_electricity_tariffs: {
				_C: {
					direct_debit_monthly: {
						code: 'E-1R-IOG-SMB-FIX-12M-26-10-14-C',
						standing_charge_inc_vat: 53.42,
						links: []
					}
				}
			}
		};

		const { fetchFn } = createFetchMock({
			'standard-unit-rates': { count: 0, results: [] },
			'day-unit-rates': { count: 0, results: [] },
			'night-unit-rates': { count: 0, results: [] },
			'/products/IOG-SMB-FIX-12M-26-10-14/': product
		});

		await expect(
			fetchDayPrices({
				productCode: 'IOG-SMB-FIX-12M-26-10-14',
				region: REGION,
				date: DATE,
				fetchFn
			})
		).rejects.toBeInstanceOf(PriceLookupError);
	});
});
