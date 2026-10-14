import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PriceChart from './PriceChart.svelte';
import { buildDaySlots, priceResolverFromBands } from '#lib/octopus/schedule';

const slots = buildDaySlots(new Date('2026-01-15T12:00:00Z'), priceResolverFromBands(32, 8));

describe('PriceChart', () => {
	beforeEach(() => {
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
			width: 900,
			height: 420,
			top: 0,
			left: 0,
			right: 900,
			bottom: 420,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders an svg chart for the day', () => {
		const { container } = render(PriceChart, {
			slots,
			now: new Date('2026-01-15T12:15:00Z'),
			height: 420
		});

		expect(container.querySelector('svg')).not.toBeNull();
		// The step area path is drawn.
		expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
	});

	it('renders nothing without slots', () => {
		const { container } = render(PriceChart, { slots: [], now: new Date(), height: 300 });
		expect(container.querySelector('svg')).toBeNull();
	});
});
