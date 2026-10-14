import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CurrentPriceCard from './CurrentPriceCard.svelte';
import type { PriceSlot } from '#lib/octopus/types';
import type { OffPeakStatus } from '#lib/octopus/schedule';

const slot: PriceSlot = {
	start: new Date('2026-01-15T23:30:00Z'),
	end: new Date('2026-01-16T00:00:00Z'),
	priceIncVat: 8,
	offPeak: true
};

const offPeakStatus: OffPeakStatus = {
	offPeak: true,
	changesAt: new Date('2026-01-16T05:30:00Z'),
	changesTo: false
};

describe('CurrentPriceCard', () => {
	it('shows the current rate, off-peak state and countdown', () => {
		render(CurrentPriceCard, {
			slot,
			status: offPeakStatus,
			now: new Date('2026-01-15T23:45:00Z'),
			standingCharge: 53.42
		});

		expect(screen.getByText('8.00')).toBeInTheDocument();
		expect(screen.getByText('Off-peak')).toBeInTheDocument();
		expect(screen.getByText(/off-peak ends/i)).toBeInTheDocument();
		expect(screen.getByText(/5h 45m/)).toBeInTheDocument();
		expect(screen.getByText(/53.42p \/ day/)).toBeInTheDocument();
	});

	it('shows the peak state when outside the window', () => {
		render(CurrentPriceCard, {
			slot: { ...slot, priceIncVat: 39.29, offPeak: false },
			status: { offPeak: false, changesAt: new Date('2026-01-15T23:30:00Z'), changesTo: true },
			now: new Date('2026-01-15T12:00:00Z'),
			standingCharge: null
		});

		expect(screen.getByText('39.29')).toBeInTheDocument();
		expect(screen.getByText('Peak')).toBeInTheDocument();
		expect(screen.getByText(/off-peak starts/i)).toBeInTheDocument();
	});
});
