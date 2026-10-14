import { describe, expect, it } from 'vitest';
import { RegionLookupError, getRegionForPostcode } from './region';
import { createFetchMock } from '../../test/fetch';

describe('getRegionForPostcode', () => {
	it('maps a postcode to its region letter', async () => {
		const { fetchFn, calls } = createFetchMock({
			'grid-supply-points': { count: 1, next: null, previous: null, results: [{ group_id: '_C' }] }
		});

		await expect(getRegionForPostcode('SW1A 1AA', fetchFn)).resolves.toBe('C');
		expect(calls[0]).toContain('postcode=SW1A1AA');
	});

	it('strips the leading underscore and accepts all region letters', async () => {
		const { fetchFn } = createFetchMock({
			'grid-supply-points': { count: 1, next: null, previous: null, results: [{ group_id: '_P' }] }
		});
		await expect(getRegionForPostcode('somewhere', fetchFn)).resolves.toBe('P');
	});

	it('throws when no result is returned', async () => {
		const { fetchFn } = createFetchMock({
			'grid-supply-points': { count: 0, next: null, previous: null, results: [] }
		});
		await expect(getRegionForPostcode('XX1 1XX', fetchFn)).rejects.toBeInstanceOf(
			RegionLookupError
		);
	});

	it('throws for an unexpected region code', async () => {
		const { fetchFn } = createFetchMock({
			'grid-supply-points': { count: 1, next: null, previous: null, results: [{ group_id: '_Z' }] }
		});
		await expect(getRegionForPostcode('SW1A1AA', fetchFn)).rejects.toBeInstanceOf(
			RegionLookupError
		);
	});

	it('requires a postcode', async () => {
		await expect(getRegionForPostcode('   ')).rejects.toBeInstanceOf(RegionLookupError);
	});
});
