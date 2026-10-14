/** Presentation helpers for prices, durations and dates. */

export function formatPrice(value: number | null | undefined, decimals = 2): string {
	if (value == null || Number.isNaN(value)) return '—';
	return `${value.toFixed(decimals)}p`;
}

/** Price without the unit suffix, for use next to a large explicit unit label. */
export function formatPriceValue(value: number | null | undefined, decimals = 2): string {
	if (value == null || Number.isNaN(value)) return '—';
	return value.toFixed(decimals);
}

export function formatStandingCharge(pencePerDay: number | null | undefined): string {
	if (pencePerDay == null || Number.isNaN(pencePerDay)) return '—';
	return `${pencePerDay.toFixed(2)}p / day`;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Human duration such as `"4h 12m"`, `"45m"` or `"2d 3h"`. */
export function formatDuration(totalMinutes: number): string {
	const minutes = Math.max(0, Math.round(totalMinutes));
	if (minutes < 1) return 'now';
	if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;

	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	const remainder = minutes % MINUTES_PER_HOUR;

	if (hours < 24) {
		return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
	}

	const days = Math.floor(minutes / MINUTES_PER_DAY);
	const remainingHours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
	return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

/** Difference between two instants expressed in whole minutes. */
export function minutesBetween(from: Date, to: Date): number {
	return (to.getTime() - from.getTime()) / 60_000;
}
