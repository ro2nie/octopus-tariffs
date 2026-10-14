import { describe, expect, it } from 'vitest';
import { formatPostcode, isValidPostcode, normalizePostcode } from './postcode';

describe('normalizePostcode', () => {
	it('removes whitespace and upper-cases', () => {
		expect(normalizePostcode(' sw1a 1aa ')).toBe('SW1A1AA');
		expect(normalizePostcode('M11AE')).toBe('M11AE');
	});
});

describe('isValidPostcode', () => {
	it.each(['SW1A 1AA', 'sw1a1aa', 'M1 1AE', 'EH1 1YZ', 'B1 1AA', 'GIR 0AA', 'DN55 1PT'])(
		'accepts %s',
		(value) => {
			expect(isValidPostcode(value)).toBe(true);
		}
	);

	it.each(['', 'ABC 123', '12345', 'SW1A 1A', 'NOT A POSTCODE', 'ZZ99 9ZZ'])(
		'rejects %s',
		(value) => {
			expect(isValidPostcode(value)).toBe(false);
		}
	);
});

describe('formatPostcode', () => {
	it('inserts a space before the inward code', () => {
		expect(formatPostcode('sw1a1aa')).toBe('SW1A 1AA');
		expect(formatPostcode('m11ae')).toBe('M1 1AE');
	});

	it('returns invalid input normalised without a space', () => {
		expect(formatPostcode('  nope ')).toBe('NOPE');
	});
});
