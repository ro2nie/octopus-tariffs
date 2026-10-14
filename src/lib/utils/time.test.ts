import { describe, expect, it } from 'vitest';
import {
	formatTime,
	getTimeZoneOffsetMinutes,
	getZonedParts,
	startOfZonedDay,
	zonedDateKey,
	zonedTimeToUtc
} from './time';

describe('getZonedParts', () => {
	it('converts a UTC instant into London wall-clock time during BST', () => {
		expect(getZonedParts(new Date('2026-10-13T23:30:00Z'))).toMatchObject({
			year: 2026,
			month: 10,
			day: 14,
			hour: 0,
			minute: 30
		});
	});

	it('handles midnight without producing hour 24', () => {
		expect(getZonedParts(new Date('2026-01-15T00:00:00Z')).hour).toBe(0);
	});
});

describe('getTimeZoneOffsetMinutes', () => {
	it('is +60 during British Summer Time', () => {
		expect(getTimeZoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'))).toBe(60);
	});

	it('is 0 during GMT', () => {
		expect(getTimeZoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(0);
	});
});

describe('zonedTimeToUtc', () => {
	it('resolves BST wall-clock midnight to the previous UTC day', () => {
		expect(zonedTimeToUtc({ year: 2026, month: 10, day: 14 }).toISOString()).toBe(
			'2026-10-13T23:00:00.000Z'
		);
	});

	it('resolves GMT wall-clock midnight to the same UTC instant', () => {
		expect(zonedTimeToUtc({ year: 2026, month: 1, day: 15 }).toISOString()).toBe(
			'2026-01-15T00:00:00.000Z'
		);
	});
});

describe('startOfZonedDay', () => {
	it('returns the UTC instant at local midnight', () => {
		expect(startOfZonedDay(new Date('2026-10-14T12:00:00Z')).toISOString()).toBe(
			'2026-10-13T23:00:00.000Z'
		);
	});

	it('accounts for the spring-forward transition', () => {
		// 29 March 2026: the clocks go forward, so the local day is 23h long.
		expect(startOfZonedDay(new Date('2026-03-29T12:00:00Z')).toISOString()).toBe(
			'2026-03-29T00:00:00.000Z'
		);
	});
});

describe('zonedDateKey', () => {
	it('gives the local calendar date', () => {
		expect(zonedDateKey(new Date('2026-10-13T23:30:00Z'))).toBe('2026-10-14');
	});
});

describe('formatTime', () => {
	it('formats to HH:MM in London time', () => {
		expect(formatTime(new Date('2026-10-14T22:30:00Z'))).toBe('23:30');
	});
});
