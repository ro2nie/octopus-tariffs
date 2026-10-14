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
	changesTo: false,
	label: 'Off-peak ends'
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
			status: {
				offPeak: false,
				changesAt: new Date('2026-01-15T23:30:00Z'),
				changesTo: true,
				label: 'Off-peak starts'
			},
			now: new Date('2026-01-15T12:00:00Z'),
			standingCharge: null
		});

		expect(screen.getByText('39.29')).toBeInTheDocument();
		expect(screen.getByText('Peak')).toBeInTheDocument();
		expect(screen.getByText(/off-peak starts/i)).toBeInTheDocument();
	});

	it('uses family wording for Agile, counting down to the next slot', () => {
		render(CurrentPriceCard, {
			slot: { ...slot, priceIncVat: 24.57, offPeak: false },
			status: {
				offPeak: false,
				changesAt: new Date('2026-01-15T23:30:00Z'),
				changesTo: true,
				label: 'Price changes'
			},
			now: new Date('2026-01-15T23:15:00Z'),
			standingCharge: 50,
			cheapLabel: 'Cheaper',
			expensiveLabel: 'Pricier'
		});

		expect(screen.getByText('Pricier')).toBeInTheDocument();
		expect(screen.getByText(/price changes/i)).toBeInTheDocument();
		expect(screen.getByText(/15m/)).toBeInTheDocument();
	});

	it('renders the outgoing variant with its own eyebrow', () => {
		render(CurrentPriceCard, {
			slot: { ...slot, priceIncVat: 4.5, offPeak: true },
			status: {
				offPeak: true,
				changesAt: new Date('2026-01-15T23:30:00Z'),
				changesTo: false,
				label: 'Price changes'
			},
			now: new Date('2026-01-15T23:15:00Z'),
			standingCharge: 0,
			eyebrow: 'Outgoing · right now',
			variant: 'export',
			cheapLabel: 'Cheaper',
			expensiveLabel: 'Pricier'
		});

		expect(screen.getByText('Outgoing · right now')).toBeInTheDocument();
		expect(screen.getByText('Cheaper')).toBeInTheDocument();
		expect(screen.getByText('0.00p / day')).toBeInTheDocument();
	});
});
