import { describe, expect, it } from 'vitest';
import {
	deserializeDayPrices,
	serializeDayPrices,
	type SerializedDayPrices
} from './serialization';
import type { DayPrices } from '#lib/octopus/types';

const prices: DayPrices = {
	date: '2026-01-15',
	region: 'C',
	family: 'intelligent-go',
	direction: 'import',
	productCode: 'IOG-SMB-FIX-12M-26-10-14',
	productName: 'Intelligent Octopus Go 12M Fixed',
	tariffCode: 'E-1R-IOG-SMB-FIX-12M-26-10-14-C',
	slots: [
		{
			start: new Date('2026-01-15T00:00:00Z'),
			end: new Date('2026-01-15T00:30:00Z'),
			priceIncVat: 8,
			offPeak: true
		}
	],
	standingChargeIncVat: 53.42,
	source: 'derived',
	fetchedAt: new Date('2026-01-15T12:00:00Z')
};

describe('serializeDayPrices / deserializeDayPrices', () => {
	it('round-trips a DayPrices value through JSON', () => {
		const restored = deserializeDayPrices(JSON.parse(JSON.stringify(serializeDayPrices(prices))));

		expect(restored.fetchedAt).toEqual(prices.fetchedAt);
		expect(restored.slots[0].start).toEqual(prices.slots[0].start);
		expect(restored.slots[0].end).toEqual(prices.slots[0].end);
		expect(restored.slots[0].priceIncVat).toBe(8);
		expect(restored.slots[0].offPeak).toBe(true);
		expect(restored.tariffCode).toBe(prices.tariffCode);
	});

	it('produces JSON-safe (string) dates', () => {
		const serialized = serializeDayPrices(prices);
		expect(typeof serialized.fetchedAt).toBe('string');
		expect(typeof serialized.slots[0].start).toBe('string');
	});

	it('round-trips the tariff family', () => {
		const agile = deserializeDayPrices(serializeDayPrices({ ...prices, family: 'agile' }));
		expect(agile.family).toBe('agile');
	});

	it('defaults legacy snapshots without a family to Intelligent Go', () => {
		const legacy: SerializedDayPrices = serializeDayPrices(prices);
		delete legacy.family;
		delete legacy.direction;
		expect(deserializeDayPrices(legacy).family).toBe('intelligent-go');
		expect(deserializeDayPrices(legacy).direction).toBe('import');
	});

	it('round-trips an export direction', () => {
		const outgoing = deserializeDayPrices(serializeDayPrices({ ...prices, direction: 'export' }));
		expect(outgoing.direction).toBe('export');
	});
});
