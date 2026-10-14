/**
 * Timezone helpers for working with the Octopus API, which schedules rates in
 * UTC but consumers experience them in `Europe/London` local time (and so must
 * switch between GMT and BST).
 */

export const LONDON_TZ = 'Europe/London';

export interface ZonedParts {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
	hour: number; // 0-23
	minute: number; // 0-59
	second: number; // 0-59
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
	let formatter = partsFormatterCache.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone,
			hour12: false,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		partsFormatterCache.set(timeZone, formatter);
	}
	return formatter;
}

/** Break an instant down into calendar fields in the given timezone. */
export function getZonedParts(date: Date, timeZone: string = LONDON_TZ): ZonedParts {
	const parts = partsFormatter(timeZone).formatToParts(date);
	const lookup: Record<string, string> = {};
	for (const part of parts) {
		if (part.type !== 'literal') lookup[part.type] = part.value;
	}
	return {
		year: Number(lookup.year),
		month: Number(lookup.month),
		day: Number(lookup.day),
		// `hour12: false` can yield "24" at midnight in some engines.
		hour: Number(lookup.hour) % 24,
		minute: Number(lookup.minute),
		second: Number(lookup.second)
	};
}

/** Offset (in minutes) of `timeZone` versus UTC at the given instant. */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string = LONDON_TZ): number {
	const parts = getZonedParts(date, timeZone);
	const asUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	);
	return (asUtc - date.getTime()) / 60_000;
}

/**
 * Convert a wall-clock time in `timeZone` into the corresponding UTC instant.
 * Handles DST transitions by resolving the offset against the resulting guess.
 */
export function zonedTimeToUtc(
	parts: Pick<ZonedParts, 'year' | 'month' | 'day'> & { hour?: number; minute?: number },
	timeZone: string = LONDON_TZ
): Date {
	const { year, month, day, hour = 0, minute = 0 } = parts;
	const guess = Date.UTC(year, month - 1, day, hour, minute);
	const firstGuess = guess - getTimeZoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
	const secondOffset = getTimeZoneOffsetMinutes(new Date(firstGuess), timeZone) * 60_000;
	return new Date(guess - secondOffset);
}

/** The UTC instant at which the local day containing `date` begins. */
export function startOfZonedDay(date: Date, timeZone: string = LONDON_TZ): Date {
	const { year, month, day } = getZonedParts(date, timeZone);
	return zonedTimeToUtc({ year, month, day }, timeZone);
}

/** ISO date (YYYY-MM-DD) of the local day containing `date`. */
export function zonedDateKey(date: Date, timeZone: string = LONDON_TZ): string {
	const { year, month, day } = getZonedParts(date, timeZone);
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: LONDON_TZ,
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: LONDON_TZ,
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: LONDON_TZ,
	weekday: 'short',
	day: 'numeric',
	month: 'short'
});

export function formatClock(date: Date): string {
	return clockFormatter.format(date);
}

/** `HH:MM` in local time, e.g. `"23:30"`. */
export function formatTime(date: Date): string {
	return timeFormatter.format(date);
}

export function formatDay(date: Date): string {
	return dayFormatter.format(date);
}

/** Format an absolute date but show a relative label for the current year. */
export function formatSlotRange(start: Date, end: Date): string {
	return `${formatTime(start)} – ${formatTime(end)}`;
}
