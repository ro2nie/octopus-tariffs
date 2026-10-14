import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, TariffStore } from './tariff.svelte';
import { createFetchMock } from '../../test/fetch';

const PRODUCTS = {
	count: 3,
	next: null,
	previous: null,
	results: [
		{
			code: 'IOG-SMB-FIX-12M-26-10-14',
			full_name: 'Intelligent Octopus Go 12M Fixed',
			display_name: 'Intelligent Octopus Go 12M Fixed',
			is_variable: false,
			is_green: false,
			is_prepay: false,
			is_business: false,
			available_from: '2026-10-14T00:00:00+01:00',
			available_to: null
		},
		{
			code: 'AGILE-24-10-01',
			full_name: 'Agile Octopus',
			display_name: 'Agile Octopus',
			is_variable: true,
			is_green: true,
			is_prepay: false,
			is_business: false,
			available_from: '2024-10-01T00:00:00+01:00',
			available_to: null
		},
		{
			code: 'AGILE-OUTGOING-19-05-13',
			full_name: 'Agile Outgoing Octopus',
			display_name: 'Agile Outgoing Octopus',
			is_variable: true,
			is_green: true,
			is_prepay: false,
			is_business: false,
			available_from: '2019-05-13T00:00:00+01:00',
			available_to: null,
			direction: 'EXPORT'
		}
	]
};

const IOG_DOC = {
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

const AGILE_DOC = {
	code: 'AGILE-24-10-01',
	full_name: 'Agile Octopus',
	display_name: 'Agile Octopus',
	is_variable: true,
	is_business: false,
	is_green: true,
	available_from: '2024-10-01T00:00:00+01:00',
	available_to: null,
	single_register_electricity_tariffs: {
		_C: {
			direct_debit_monthly: {
				code: 'E-1R-AGILE-24-10-01-C',
				standing_charge_inc_vat: 60.97,
				links: []
			}
		}
	}
};

const AGILE_OUTGOING_DOC = {
	code: 'AGILE-OUTGOING-19-05-13',
	full_name: 'Agile Outgoing Octopus',
	display_name: 'Agile Outgoing Octopus',
	is_variable: true,
	is_business: false,
	is_green: true,
	available_from: '2019-05-13T00:00:00+01:00',
	available_to: null,
	single_register_electricity_tariffs: {
		_C: {
			direct_debit_monthly: {
				code: 'E-1R-AGILE-OUTGOING-19-05-13-C',
				standing_charge_inc_vat: 0,
				links: []
			}
		}
	}
};

/** 48 half-hourly rates: cheap before noon, pricier after. */
function halfHourlyRates(cheap: number, pricier: number) {
	return {
		count: 48,
		next: null,
		previous: null,
		results: Array.from({ length: 48 }, (_, index) => {
			const start = new Date(Date.UTC(2026, 0, 15, 0, 0) + index * 30 * 60_000);
			return {
				value_exc_vat: 0,
				value_inc_vat: index < 24 ? cheap : pricier,
				valid_from: start.toISOString(),
				valid_to: new Date(start.getTime() + 30 * 60_000).toISOString(),
				payment_method: null
			};
		})
	};
}

function routes() {
	return {
		'grid-supply-points': { count: 1, next: null, previous: null, results: [{ group_id: '_C' }] },
		'/products/?brand=': PRODUCTS,
		// Rate keys must precede the product-document keys (substring matching).
		'E-1R-IOG-SMB-FIX-12M-26-10-14-C/standard-unit-rates': { count: 0, results: [] },
		'E-1R-AGILE-24-10-01-C/standard-unit-rates': halfHourlyRates(10, 20),
		'E-1R-AGILE-OUTGOING-19-05-13-C/standard-unit-rates': halfHourlyRates(4, 9),
		'/products/IOG-SMB-FIX-12M-26-10-14/': IOG_DOC,
		'/products/AGILE-24-10-01/': AGILE_DOC,
		'/products/AGILE-OUTGOING-19-05-13/': AGILE_OUTGOING_DOC
	};
}

describe('TariffStore family handling', () => {
	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
	});

	it('defaults to Intelligent Go, then rediscovers Agile products', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
		const { fetchFn } = createFetchMock(routes());
		const store = new TariffStore(fetchFn);

		store.setPostcode('SW1A 1AA');
		await store.load();
		expect(store.family).toBe('intelligent-go');
		expect(store.productCode).toBe('IOG-SMB-FIX-12M-26-10-14');
		expect(store.prices?.family).toBe('intelligent-go');
		expect(store.outgoing).toBeNull();

		await store.setFamily('agile');
		expect(store.family).toBe('agile');
		expect(store.productCode).toBe('AGILE-24-10-01');
		expect(store.prices?.family).toBe('agile');
		expect(store.prices?.direction).toBe('import');
		expect(store.outgoingProductCode).toBe('AGILE-OUTGOING-19-05-13');
		expect(store.outgoing?.direction).toBe('export');
		expect(store.outgoing?.slots).toHaveLength(48);

		const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		expect(persisted.family).toBe('agile');
		expect(persisted.outgoingProductCode).toBe('AGILE-OUTGOING-19-05-13');
	});

	it('ignores a repeated family selection', async () => {
		const store = new TariffStore(createFetchMock(routes()).fetchFn);
		await store.setFamily('intelligent-go');
		expect(store.family).toBe('intelligent-go');
	});

	it('restores legacy snapshots without a family as Intelligent Go', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				postcode: 'SW1A 1AA',
				productCode: 'IOG-SMB-FIX-12M-26-10-14',
				region: 'C',
				productName: null,
				snapshot: null,
				savedAt: null
			})
		);

		const store = new TariffStore();
		expect(store.family).toBe('intelligent-go');
		expect(store.postcode).toBe('SW1A 1AA');
	});
});
