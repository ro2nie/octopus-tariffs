import type {
	DayPrices,
	PriceSlot,
	RegionCode,
	TariffDirection,
	TariffFamily
} from '#lib/octopus/types';

export interface SerializedPriceSlot extends Omit<PriceSlot, 'start' | 'end'> {
	start: string;
	end: string;
}

export interface SerializedDayPrices extends Omit<
	DayPrices,
	'slots' | 'fetchedAt' | 'family' | 'direction'
> {
	slots: SerializedPriceSlot[];
	fetchedAt: string;
	/** Optional so snapshots saved before tariff families existed still restore. */
	family?: TariffFamily;
	/** Optional so snapshots saved before export tariffs existed still restore. */
	direction?: TariffDirection;
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
		family: data.family ?? 'intelligent-go',
		direction: data.direction ?? 'import',
		fetchedAt: new Date(data.fetchedAt),
		slots: data.slots.map((slot) => ({
			...slot,
			start: new Date(slot.start),
			end: new Date(slot.end)
		}))
	};
}
