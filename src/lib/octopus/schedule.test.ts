import { describe, expect, it } from 'vitest';
import {
	buildDaySlots,
	classifyRelativeOffPeak,
	getCurrentSlot,
	getOffPeakStatus,
	getSlotStatus,
	INTELLIGENT_GO_WINDOW,
	isOffPeakInstant,
	isWithinWindow,
	OCTOPUS_GO_WINDOW,
	priceBounds,
	priceResolverFromBands,
	priceResolverFromIntervals
} from './schedule';
import type { PriceInterval, PriceSlot } from './types';

describe('isOffPeakInstant', () => {
	it.each([
		['2026-01-15T23:30:00Z', true],
		['2026-01-15T23:29:00Z', false],
		['2026-01-15T00:00:00Z', true],
		['2026-01-15T05:29:00Z', true],
		['2026-01-15T05:30:00Z', false],
		['2026-01-15T12:00:00Z', false]
	])('classifies %s as offPeak=%s', (iso, expected) => {
		expect(isOffPeakInstant(new Date(iso))).toBe(expected);
	});
});

describe('isWithinWindow', () => {
	it('handles a window that wraps past midnight', () => {
		// Intelligent Go: 23:30 – 05:30.
		expect(isWithinWindow(23 * 60 + 30, INTELLIGENT_GO_WINDOW)).toBe(true);
		expect(isWithinWindow(0, INTELLIGENT_GO_WINDOW)).toBe(true);
		expect(isWithinWindow(5 * 60 + 29, INTELLIGENT_GO_WINDOW)).toBe(true);
		expect(isWithinWindow(5 * 60 + 30, INTELLIGENT_GO_WINDOW)).toBe(false);
		expect(isWithinWindow(12 * 60, INTELLIGENT_GO_WINDOW)).toBe(false);
	});

	it('handles a window within the same day', () => {
		// Octopus Go: 00:30 – 04:30.
		expect(isWithinWindow(0, OCTOPUS_GO_WINDOW)).toBe(false);
		expect(isWithinWindow(0 * 60 + 30, OCTOPUS_GO_WINDOW)).toBe(true);
		expect(isWithinWindow(4 * 60 + 29, OCTOPUS_GO_WINDOW)).toBe(true);
		expect(isWithinWindow(4 * 60 + 30, OCTOPUS_GO_WINDOW)).toBe(false);
		expect(isWithinWindow(12 * 60, OCTOPUS_GO_WINDOW)).toBe(false);
	});
});

describe('isOffPeakInstant (Octopus Go)', () => {
	it.each([
		['2026-01-15T00:00:00Z', false],
		['2026-01-15T00:30:00Z', true],
		['2026-01-15T04:29:00Z', true],
		['2026-01-15T04:30:00Z', false],
		['2026-01-15T12:00:00Z', false],
		['2026-01-15T23:30:00Z', false]
	])('classifies %s as offPeak=%s', (iso, expected) => {
		expect(isOffPeakInstant(new Date(iso), OCTOPUS_GO_WINDOW)).toBe(expected);
	});
});

describe('getOffPeakStatus', () => {
	it('reports the next transition to peak from within the window', () => {
		const status = getOffPeakStatus(new Date('2026-01-15T23:45:00Z'));
		expect(status.offPeak).toBe(true);
		expect(status.changesTo).toBe(false);
		expect(status.changesAt.toISOString()).toBe('2026-01-16T05:30:00.000Z');
	});

	it('reports the next transition to off-peak during the day', () => {
		const status = getOffPeakStatus(new Date('2026-01-15T12:00:00Z'));
		expect(status.offPeak).toBe(false);
		expect(status.changesTo).toBe(true);
		expect(status.changesAt.toISOString()).toBe('2026-01-15T23:30:00.000Z');
		expect(status.label).toBe('Off-peak starts');
	});

	it('uses the given window (Octopus Go 00:30 – 04:30)', () => {
		const within = getOffPeakStatus(new Date('2026-01-15T02:00:00Z'), OCTOPUS_GO_WINDOW);
		expect(within.offPeak).toBe(true);
		expect(within.changesTo).toBe(false);
		expect(within.changesAt.toISOString()).toBe('2026-01-15T04:30:00.000Z');

		const outside = getOffPeakStatus(new Date('2026-01-15T12:00:00Z'), OCTOPUS_GO_WINDOW);
		expect(outside.offPeak).toBe(false);
		expect(outside.changesTo).toBe(true);
		expect(outside.changesAt.toISOString()).toBe('2026-01-16T00:30:00.000Z');
	});
});

describe('classifyRelativeOffPeak', () => {
	const slots: PriceSlot[] = [4, 4, 4, 12].map((price, index) => ({
		start: new Date(`2026-01-15T0${index}:00:00Z`),
		end: new Date(`2026-01-15T0${index}:30:00Z`),
		priceIncVat: price,
		offPeak: false
	}));

	it('marks below-average slots as off-peak', () => {
		expect(classifyRelativeOffPeak(slots)).toEqual([true, true, true, false]);
	});

	it('marks nothing when there are no prices', () => {
		expect(classifyRelativeOffPeak([])).toEqual([]);
	});
});

describe('getSlotStatus', () => {
	const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), priceResolverFromBands(32, 8));

	it('points at the end of the current half-hour slot', () => {
		const status = getSlotStatus(slots, new Date('2026-01-15T12:15:00Z'));
		expect(status.label).toBe('Price changes');
		expect(status.offPeak).toBe(false);
		expect(status.changesAt.toISOString()).toBe('2026-01-15T12:30:00.000Z');
	});

	it('falls back gracefully with no slots', () => {
		const now = new Date('2026-01-15T12:15:00Z');
		const status = getSlotStatus([], now);
		expect(status.offPeak).toBe(false);
		expect(status.changesAt).toBe(now);
	});
});

describe('priceResolverFromIntervals', () => {
	const intervals: PriceInterval[] = [
		{
			start: new Date('2026-01-15T00:00:00Z'),
			end: new Date('2026-01-15T04:30:00Z'),
			priceIncVat: 8
		},
		{
			start: new Date('2026-01-15T04:30:00Z'),
			end: new Date('2026-01-15T22:30:00Z'),
			priceIncVat: 32
		},
		{
			start: new Date('2026-01-15T22:30:00Z'),
			end: new Date('2026-01-16T00:00:00Z'),
			priceIncVat: 8
		}
	];
	const resolve = priceResolverFromIntervals(intervals);

	it('resolves a price inside an interval', () => {
		expect(resolve(new Date('2026-01-15T12:00:00Z'))).toBe(32);
		expect(resolve(new Date('2026-01-15T23:00:00Z'))).toBe(8);
	});

	it('treats interval end as exclusive', () => {
		expect(resolve(new Date('2026-01-15T04:30:00Z'))).toBe(32);
	});

	it('returns null before the first interval', () => {
		expect(resolve(new Date('2026-01-14T12:00:00Z'))).toBeNull();
	});

	it('sorts unordered intervals', () => {
		const unordered = [intervals[2], intervals[0], intervals[1]];
		expect(priceResolverFromIntervals(unordered)(new Date('2026-01-15T12:00:00Z'))).toBe(32);
	});
});

describe('buildDaySlots', () => {
	it('creates 48 half-hour slots on a normal day', () => {
		const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), priceResolverFromBands(32, 8));
		expect(slots).toHaveLength(48);
		expect(slots[0].start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
		expect(slots.at(-1)?.end.toISOString()).toBe('2026-01-16T00:00:00.000Z');
	});

	it('creates 46 slots on the spring-forward day', () => {
		const slots = buildDaySlots(new Date('2026-03-29T09:00:00Z'), priceResolverFromBands(32, 8));
		expect(slots).toHaveLength(46);
	});

	it('creates 50 slots on the autumn day', () => {
		const slots = buildDaySlots(new Date('2026-10-25T09:00:00Z'), priceResolverFromBands(32, 8));
		expect(slots).toHaveLength(50);
	});

	it('flags the overnight window as off-peak', () => {
		const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), priceResolverFromBands(32, 8));
		const last = slots.at(-1)!;
		expect(last.offPeak).toBe(true);
		expect(last.priceIncVat).toBe(8);
		const midday = slots.find((s) => s.start.toISOString() === '2026-01-15T12:00:00.000Z')!;
		expect(midday.offPeak).toBe(false);
		expect(midday.priceIncVat).toBe(32);
	});

	it('skips slots with no resolvable price', () => {
		const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), () => null);
		expect(slots).toHaveLength(0);
	});
});

describe('getCurrentSlot', () => {
	const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), priceResolverFromBands(32, 8));

	it('returns the covering slot', () => {
		const slot = getCurrentSlot(slots, new Date('2026-01-15T12:15:00Z'))!;
		expect(slot.start.toISOString()).toBe('2026-01-15T12:00:00.000Z');
	});

	it('returns the nearest slot when out of range', () => {
		const slot = getCurrentSlot(slots, new Date('2026-01-17T00:00:00Z'))!;
		expect(slot.start.toISOString()).toBe('2026-01-15T23:30:00.000Z');
	});

	it('returns null for an empty list', () => {
		expect(getCurrentSlot([], new Date())).toBeNull();
	});
});

describe('priceBounds', () => {
	it('returns min and max across slots', () => {
		const slots = buildDaySlots(new Date('2026-01-15T09:00:00Z'), priceResolverFromBands(32, 8));
		expect(priceBounds(slots)).toEqual({ min: 8, max: 32 });
	});

	it('handles an empty list', () => {
		expect(priceBounds([])).toEqual({ min: 0, max: 1 });
	});
});
