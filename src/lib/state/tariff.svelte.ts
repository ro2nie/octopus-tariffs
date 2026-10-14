import { fetchDayPrices } from '#lib/octopus/prices';
import { getRegionForPostcode } from '#lib/octopus/region';
import { isValidPostcode, normalizePostcode } from '#lib/octopus/postcode';
import { listIntelligentGoProducts, selectDefaultProduct } from '#lib/octopus/product';
import type { DayPrices, OctopusProductSummary, RegionCode } from '#lib/octopus/types';
import type { FetchLike } from '#lib/octopus/client';
import {
	deserializeDayPrices,
	serializeDayPrices,
	type SerializedDayPrices
} from './serialization';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export const STORAGE_KEY = 'octopus-intelligent-go:state:v1';
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface PersistedState {
	postcode: string;
	productCode: string;
	region: RegionCode | null;
	productName: string | null;
	snapshot: SerializedDayPrices | null;
	savedAt: number | null;
}

function toMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return 'Something went wrong talking to Octopus Energy. Please try again.';
}

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/**
 * Reactive store owning the full tariff lifecycle: the entered postcode, the
 * resolved region, the discovered product list, and the fetched day prices.
 *
 * Kept independent of `$app/*` so it can be exercised from plain unit tests.
 */
export class TariffStore {
	postcode = $state('');
	productCode = $state('');
	region = $state<RegionCode | null>(null);
	productName = $state<string | null>(null);
	products = $state<OctopusProductSummary[]>([]);
	prices = $state<DayPrices | null>(null);
	status = $state<LoadStatus>('idle');
	error = $state<string | null>(null);
	lastUpdated = $state<Date | null>(null);

	readonly #fetchFn: FetchLike | undefined;

	constructor(fetchFn?: FetchLike) {
		this.#fetchFn = fetchFn;
		this.#restore();
	}

	get hasPostcode(): boolean {
		return this.postcode.length > 0;
	}

	/** Update the postcode and persist it, without triggering a fetch. */
	setPostcode(value: string): void {
		this.postcode = normalizePostcode(value);
		this.error = null;
		this.#persist();
	}

	/** Full load: resolve region, discover tariffs, then fetch today's prices. */
	async load(): Promise<void> {
		const postcode = normalizePostcode(this.postcode);
		if (!isValidPostcode(postcode)) {
			this.status = 'error';
			this.error = 'Please enter a valid UK postcode.';
			return;
		}

		this.postcode = postcode;
		this.status = 'loading';
		this.error = null;

		try {
			this.region = await getRegionForPostcode(postcode, this.#fetchFn);

			const products = await listIntelligentGoProducts(this.#fetchFn);
			if (products.length === 0) {
				throw new Error('No Intelligent Octopus Go tariffs are currently available.');
			}
			this.products = products;

			const selected =
				products.find((product) => product.code === this.productCode) ??
				selectDefaultProduct(products);
			if (!selected) {
				throw new Error('Could not select an Intelligent Octopus Go tariff.');
			}
			this.productCode = selected.code;
			this.productName = selected.display_name;

			await this.refresh();
		} catch (error) {
			this.error = toMessage(error);
			this.status = 'error';
		}
	}

	/** Re-fetch the current product's prices (used by the 10-minute poll). */
	async refresh(): Promise<void> {
		if (!this.postcode || !this.productCode || !this.region) return;

		try {
			const prices = await fetchDayPrices({
				productCode: this.productCode,
				region: this.region,
				fetchFn: this.#fetchFn
			});
			this.prices = prices;
			// The timestamp is always replaced wholesale, so a plain Date is safe here.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			this.lastUpdated = new Date();
			this.status = 'ready';
			this.error = null;
			this.#persist();
		} catch (error) {
			this.error = toMessage(error);
			if (!this.prices) this.status = 'error';
		}
	}

	/** Switch to a different Intelligent Octopus Go product and reload. */
	async selectProduct(code: string): Promise<void> {
		if (code === this.productCode) return;
		this.productCode = code;
		this.productName = this.products.find((product) => product.code === code)?.display_name ?? null;
		await this.refresh();
	}

	/** Forget the saved postcode and snapshot. */
	clear(): void {
		this.postcode = '';
		this.productCode = '';
		this.region = null;
		this.productName = null;
		this.products = [];
		this.prices = null;
		this.status = 'idle';
		this.error = null;
		this.lastUpdated = null;
		storage()?.removeItem(STORAGE_KEY);
	}

	#restore(): void {
		const raw = storage()?.getItem(STORAGE_KEY);
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as PersistedState;
			this.postcode = parsed.postcode ?? '';
			this.productCode = parsed.productCode ?? '';
			this.region = parsed.region ?? null;
			this.productName = parsed.productName ?? null;
			if (parsed.snapshot) {
				this.prices = deserializeDayPrices(parsed.snapshot);
			}
			this.status = this.prices ? 'ready' : 'idle';
		} catch {
			storage()?.removeItem(STORAGE_KEY);
		}
	}

	#persist(): void {
		const store = storage();
		if (!store) return;

		const state: PersistedState = {
			postcode: this.postcode,
			productCode: this.productCode,
			region: this.region,
			productName: this.productName,
			snapshot: this.prices ? serializeDayPrices(this.prices) : null,
			savedAt: this.lastUpdated ? this.lastUpdated.getTime() : null
		};

		try {
			store.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// Ignore quota/private-mode failures; caching is best-effort.
		}
	}
}
