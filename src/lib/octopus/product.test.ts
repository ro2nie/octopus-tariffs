import { describe, expect, it } from 'vitest';
import {
	fetchProduct,
	isCurrentlyAvailable,
	isEvSaver,
	listExportProducts,
	listIntelligentGoProducts,
	listOctopusGoProducts,
	listTariffProducts,
	selectDefaultProduct
} from './product';
import { createFetchMock } from '../../test/fetch';
import type { OctopusProductSummary } from './types';

function product(overrides: Partial<OctopusProductSummary>): OctopusProductSummary {
	return {
		code: 'X',
		full_name: 'X',
		display_name: 'X',
		is_variable: false,
		is_green: false,
		is_prepay: false,
		is_business: false,
		available_from: '2026-01-01T00:00:00Z',
		available_to: null,
		...overrides
	};
}

const CATALOGUE = {
	count: 5,
	next: null,
	previous: null,
	results: [
		product({ code: 'AGILE-24-10-01', display_name: 'Agile Octopus' }),
		product({
			code: 'IOG-SMB-FIX-12M-26-10-14',
			display_name: 'Intelligent Octopus Go 12M Fixed',
			available_from: '2026-10-14T00:00:00+01:00'
		}),
		product({
			code: 'IOG-SMB-FIX-OEV-12M-26-10-14',
			display_name: 'Intelligent Octopus Go 12M Fixed - EV Saver',
			available_from: '2026-10-14T00:00:00+01:00'
		}),
		product({
			code: 'INTELLI-FIX-12M-26-04-18',
			display_name: 'Intelligent Octopus Go 12M Fixed',
			available_from: '2026-04-18T00:00:00+01:00',
			available_to: '2026-06-13T00:00:00+01:00'
		}),
		product({
			code: 'IOG-BUSINESS',
			display_name: 'Intelligent Octopus Go Business',
			is_business: true
		})
	]
};

describe('listIntelligentGoProducts', () => {
	it('returns only domestic Intelligent Octopus Go tariffs, newest available first', async () => {
		const { fetchFn } = createFetchMock({ '/products/': CATALOGUE });
		const products = await listIntelligentGoProducts(fetchFn);

		expect(products.map((p) => p.code)).toEqual([
			'IOG-SMB-FIX-12M-26-10-14',
			'IOG-SMB-FIX-OEV-12M-26-10-14',
			'INTELLI-FIX-12M-26-04-18'
		]);
	});
});

describe('listOctopusGoProducts', () => {
	const catalogue = {
		count: 5,
		next: null,
		previous: null,
		results: [
			product({ code: 'GO-VAR-22-10-14', display_name: 'Octopus Go' }),
			product({ code: 'GO-FASTER-4', display_name: 'Octopus Go Faster' }),
			product({ code: 'IOG-SMB-FIX-12M-26-10-14', display_name: 'Intelligent Octopus Go' }),
			product({ code: 'GO-BUSINESS', display_name: 'Octopus Go Business', is_business: true }),
			product({ code: 'GO-EXPORT', display_name: 'Octopus Go', direction: 'EXPORT' })
		]
	};

	it('returns only classic Octopus Go import products', async () => {
		const { fetchFn } = createFetchMock({ '/products/': catalogue });
		const products = await listOctopusGoProducts(fetchFn);
		expect(products.map((p) => p.code)).toEqual(['GO-VAR-22-10-14']);
	});
});

describe('listTariffProducts', () => {
	it('discovers Agile import products, excluding Outgoing, export and business', async () => {
		const catalogue = {
			count: 4,
			next: null,
			previous: null,
			results: [
				product({ code: 'AGILE-24-10-01', display_name: 'Agile Octopus' }),
				product({ code: 'AGILE-OUTGOING-19-05-31', display_name: 'Agile Outgoing Octopus' }),
				product({
					code: 'AGILE-EXPORT-24-01-01',
					display_name: 'Agile Octopus',
					direction: 'EXPORT'
				}),
				product({ code: 'AGILE-BUSINESS', display_name: 'Agile Octopus', is_business: true })
			]
		};
		const { fetchFn } = createFetchMock({ '/products/': catalogue });

		const products = await listTariffProducts('agile', fetchFn);
		expect(products.map((p) => p.code)).toEqual(['AGILE-24-10-01']);
	});
});

describe('listExportProducts', () => {
	const catalogue = {
		count: 3,
		next: null,
		previous: null,
		results: [
			product({
				code: 'AGILE-OUTGOING-19-05-13',
				display_name: 'Agile Outgoing Octopus',
				direction: 'EXPORT'
			}),
			product({ code: 'AGILE-24-10-01', display_name: 'Agile Octopus', direction: 'IMPORT' }),
			product({
				code: 'FLUX-EXPORT-23-02-14',
				display_name: 'Octopus Flux Export',
				direction: 'EXPORT'
			})
		]
	};

	it('finds the Agile Outgoing export product', async () => {
		const { fetchFn } = createFetchMock({ '/products/': catalogue });
		const products = await listExportProducts('agile', fetchFn);
		expect(products.map((p) => p.code)).toEqual(['AGILE-OUTGOING-19-05-13']);
	});

	it('returns none for families without an export tariff', async () => {
		const { fetchFn } = createFetchMock({ '/products/': catalogue });
		expect(await listExportProducts('intelligent-go', fetchFn)).toEqual([]);
	});
});

describe('isEvSaver / isCurrentlyAvailable', () => {
	it('detects the EV Saver variant', () => {
		expect(
			isEvSaver(product({ display_name: 'Intelligent Octopus Go 12M Fixed - EV Saver' }))
		).toBe(true);
		expect(isEvSaver(product({ display_name: 'Intelligent Octopus Go 12M Fixed' }))).toBe(false);
	});

	it('detects availability', () => {
		expect(isCurrentlyAvailable(product({ available_to: null }))).toBe(true);
		expect(isCurrentlyAvailable(product({ available_to: '2026-06-13T00:00:00Z' }))).toBe(false);
	});
});

describe('selectDefaultProduct', () => {
	it('prefers the current, non-EV-Saver tariff', async () => {
		const { fetchFn } = createFetchMock({ '/products/': CATALOGUE });
		const products = await listIntelligentGoProducts(fetchFn);
		expect(selectDefaultProduct(products)?.code).toBe('IOG-SMB-FIX-12M-26-10-14');
	});

	it('falls back sensibly when only EV Saver variants exist', () => {
		const products = [product({ display_name: 'Intelligent Octopus Go 12M Fixed - EV Saver' })];
		expect(selectDefaultProduct(products)?.code).toBe('X');
	});

	it('returns undefined for an empty list', () => {
		expect(selectDefaultProduct([])).toBeUndefined();
	});
});

describe('fetchProduct', () => {
	it('requests the product document', async () => {
		const { fetchFn, calls } = createFetchMock({
			'/products/IOG-SMB-FIX-12M-26-10-14/': { code: 'IOG-SMB-FIX-12M-26-10-14' }
		});
		const result = await fetchProduct('IOG-SMB-FIX-12M-26-10-14', fetchFn);
		expect(result.code).toBe('IOG-SMB-FIX-12M-26-10-14');
		expect(calls[0]).toContain('/products/IOG-SMB-FIX-12M-26-10-14/');
	});

	it('throws without a code', async () => {
		await expect(fetchProduct('')).rejects.toThrow();
	});
});
