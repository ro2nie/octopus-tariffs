import { describe, expect, it } from 'vitest';
import {
	formatDuration,
	formatPrice,
	formatPriceValue,
	formatStandingCharge,
	minutesBetween
} from './format';

describe('formatPrice', () => {
	it('formats pence to two decimals with a suffix', () => {
		expect(formatPrice(8)).toBe('8.00p');
		expect(formatPrice(39.2881)).toBe('39.29p');
	});

	it('handles missing values', () => {
		expect(formatPrice(null)).toBe('—');
		expect(formatPrice(undefined)).toBe('—');
		expect(formatPrice(Number.NaN)).toBe('—');
	});
});

describe('formatPriceValue', () => {
	it('omits the suffix', () => {
		expect(formatPriceValue(8)).toBe('8.00');
	});
});

describe('formatStandingCharge', () => {
	it('includes a per-day suffix', () => {
		expect(formatStandingCharge(53.42)).toBe('53.42p / day');
		expect(formatStandingCharge(null)).toBe('—');
	});
});

describe('formatDuration', () => {
	it.each([
		[0, 'now'],
		[1, '1m'],
		[45, '45m'],
		[60, '1h'],
		[252, '4h 12m'],
		[1440, '1d'],
		[1500, '1d 1h']
	])('formats %i minutes as %s', (minutes, expected) => {
		expect(formatDuration(minutes as number)).toBe(expected);
	});
});

describe('minutesBetween', () => {
	it('returns the difference in minutes', () => {
		expect(minutesBetween(new Date('2026-01-15T10:00:00Z'), new Date('2026-01-15T10:30:00Z'))).toBe(
			30
		);
	});
});
