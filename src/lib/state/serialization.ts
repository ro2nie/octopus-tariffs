import type { DayPrices, PriceSlot, RegionCode } from '#lib/octopus/types';

export interface SerializedPriceSlot extends Omit<PriceSlot, 'start' | 'end'> {
	start: string;
	end: string;
}

export interface SerializedDayPrices extends Omit<DayPrices, 'slots' | 'fetchedAt'> {
	slots: SerializedPriceSlot[];
	fetchedAt: string;
}

/** Convert a `DayPrices` value into a JSON-safe shape for localStorage. */
export function serializeDayPrices(prices: DayPrices): SerializedDayPrices {
	return {
		...prices,
		fetchedAt: prices.fetchedAt.toISOString(),
		slots: prices.slots.map((slot) => ({
			...slot,
			start: slot.start.toISOString(),
			end: slot.end.toISOString()
		}))
	};
}

export function deserializeDayPrices(data: SerializedDayPrices): DayPrices {
	return {
		...data,
		region: data.region as RegionCode,
		fetchedAt: new Date(data.fetchedAt),
		slots: data.slots.map((slot) => ({
			...slot,
			start: new Date(slot.start),
			end: new Date(slot.end)
		}))
	};
}
