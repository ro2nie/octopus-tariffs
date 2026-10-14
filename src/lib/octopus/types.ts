/**
 * Shared types for the (public) Octopus Energy REST API and the app's own
 * domain model. Only the fields this app actually consumes are modelled.
 */

export const REGION_CODES = [
	'A',
	'B',
	'C',
	'D',
	'E',
	'F',
	'G',
	'H',
	'J',
	'K',
	'L',
	'M',
	'N',
	'P'
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

/**
 * The tariff families this app understands. Each has its own product-discovery
 * rules and its own way of deciding which half-hours count as "off-peak".
 */
export type TariffFamily = 'intelligent-go' | 'octopus-go' | 'agile';

/** Whether a tariff measures electricity imported from the grid or exported to it. */
export type TariffDirection = 'import' | 'export';

export interface Paginated<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T[];
}

export interface GridSupplyPoint {
	group_id: string;
}

export interface OctopusProductSummary {
	code: string;
	direction?: string;
	full_name: string;
	display_name: string;
	description?: string;
	is_variable: boolean;
	is_green: boolean;
	is_tracker?: boolean;
	is_prepay: boolean;
	is_business: boolean;
	is_restricted?: boolean;
	term?: number | null;
	available_from: string;
	available_to: string | null;
	brand?: string;
}

export interface UnitRate {
	value_exc_vat: number;
	value_inc_vat: number;
	valid_from: string;
	valid_to: string | null;
	payment_method: string | null;
}

export interface TariffInfo {
	code: string;
	standing_charge_inc_vat: number;
	standard_unit_rate_inc_vat?: number | null;
	day_unit_rate_inc_vat?: number | null;
	night_unit_rate_inc_vat?: number | null;
	links: { href: string; method: string; rel: string }[];
}

interface PaymentMethods {
	[key: string]: TariffInfo;
}

export interface OctopusProduct {
	code: string;
	full_name: string;
	display_name: string;
	description?: string;
	is_variable: boolean;
	is_business: boolean;
	is_green: boolean;
	available_from: string;
	available_to: string | null;
	single_register_electricity_tariffs?: Record<string, PaymentMethods>;
	dual_register_electricity_tariffs?: Record<string, PaymentMethods>;
	four_rate_ev_electricity_tariffs?: Record<string, PaymentMethods>;
}

/** A single unit-rate interval as returned by the API (may span many hours). */
export interface PriceInterval {
	start: Date;
	end: Date;
	priceIncVat: number;
}

/**
 * One half-hour settlement slot for the selected local day. Prices are always
 * pence per kWh including VAT, matching the numbers shown on a bill.
 */
export interface PriceSlot {
	start: Date;
	end: Date;
	priceIncVat: number;
	offPeak: boolean;
}

/** How the day's prices were obtained from the API. */
export type PriceSource = 'schedule' | 'derived';

export interface DayPrices {
	/** ISO date (YYYY-MM-DD) of the London-local day these prices cover. */
	date: string;
	region: RegionCode;
	family: TariffFamily;
	direction: TariffDirection;
	productCode: string;
	productName: string;
	tariffCode: string;
	slots: PriceSlot[];
	standingChargeIncVat: number | null;
	source: PriceSource;
	fetchedAt: Date;
}
