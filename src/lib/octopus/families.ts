/**
 * The tariff families the kiosk can display. Each family bundles the copy shown
 * in the UI with the rules for discovering its products and for deciding which
 * half-hours are "off-peak" (cheap).
 */

import {
	classifyRelativeOffPeak,
	getOffPeakStatus,
	getSlotStatus,
	INTELLIGENT_GO_WINDOW,
	isOffPeakInstant,
	OCTOPUS_GO_WINDOW,
	type OffPeakStatus,
	type OffPeakWindow
} from './schedule';
import type { OctopusProductSummary, PriceSlot, TariffFamily } from './types';

export interface TariffFamilyConfig {
	id: TariffFamily;
	/** Full name, e.g. "Intelligent Octopus Go". */
	label: string;
	/** Compact name for the toggle, e.g. "Intelligent Go". */
	shortLabel: string;
	description: string;
	/** Wording for a cheap slot, e.g. "Off-peak". */
	cheapLabel: string;
	/** Wording for an expensive slot, e.g. "Peak". */
	expensiveLabel: string;
	/** Series label for the import (consumption) tariff, shown on charts/tooltips. */
	importLabel: string;
	/** Present when this family has a matching export (outgoing) tariff. */
	export: { label: string; matches(product: OctopusProductSummary): boolean } | null;
	/** Fixed overnight cheap window (minutes into the local day), or null. */
	window: OffPeakWindow | null;
	/** Human-readable cheap window, e.g. "23:30 – 05:30", or null. */
	windowLabel: string | null;
	/** Marks each slot as off-peak using this family's rules. */
	classifyOffPeak(slots: readonly PriceSlot[]): boolean[];
	/** Live cheap/expensive status and the next change, for the current card. */
	status(slots: readonly PriceSlot[], now: Date): OffPeakStatus;
	/** True when a product belongs to this family's import electricity tariffs. */
	matches(product: OctopusProductSummary): boolean;
}

const INTELLIGENT_GO_PATTERN = /intelligent octopus go/i;
const OCTOPUS_GO_PATTERN = /octopus go/i;
const INTELLIGENT_PATTERN = /intelligent/i;
const GO_FASTER_PATTERN = /go faster/i;
const AGILE_PATTERN = /agile octopus/i;
const AGILE_OUTGOING_PATTERN = /agile outgoing/i;
const OUTGOING_PATTERN = /outgoing|export/i;

/** Export products (e.g. Agile Outgoing) are never offered for import. */
export function isExportProduct(product: OctopusProductSummary): boolean {
	return (
		OUTGOING_PATTERN.test(product.display_name) || product.direction?.toUpperCase() === 'EXPORT'
	);
}

function matchesPattern(pattern: RegExp) {
	return (product: OctopusProductSummary): boolean =>
		!product.is_business && !isExportProduct(product) && pattern.test(product.display_name);
}

/** Mark every slot inside a fixed overnight window as off-peak. */
function fixedWindowClassify(window: OffPeakWindow) {
	return (slots: readonly PriceSlot[]): boolean[] =>
		slots.map((slot) => isOffPeakInstant(slot.start, window));
}

/** Live status for a family with a fixed overnight window. */
function fixedWindowStatus(window: OffPeakWindow) {
	return (_slots: readonly PriceSlot[], now: Date): OffPeakStatus => getOffPeakStatus(now, window);
}

/**
 * Classic Octopus Go shares its name with the "Intelligent" and "Faster"
 * variants, so match "Octopus Go" while excluding those named tariffs.
 */
function matchesOctopusGo(product: OctopusProductSummary): boolean {
	return (
		!product.is_business &&
		!isExportProduct(product) &&
		OCTOPUS_GO_PATTERN.test(product.display_name) &&
		!INTELLIGENT_PATTERN.test(product.display_name) &&
		!GO_FASTER_PATTERN.test(product.display_name)
	);
}

const intelligentGo: TariffFamilyConfig = {
	id: 'intelligent-go',
	label: 'Intelligent Octopus Go',
	shortLabel: 'Intelligent Go',
	description: 'Cheap overnight charging window, every night 23:30–05:30.',
	cheapLabel: 'Off-peak',
	expensiveLabel: 'Peak',
	importLabel: 'Intelligent Go',
	export: null,
	window: INTELLIGENT_GO_WINDOW,
	windowLabel: '23:30 – 05:30',
	classifyOffPeak: fixedWindowClassify(INTELLIGENT_GO_WINDOW),
	status: fixedWindowStatus(INTELLIGENT_GO_WINDOW),
	matches: matchesPattern(INTELLIGENT_GO_PATTERN)
};

const octopusGo: TariffFamilyConfig = {
	id: 'octopus-go',
	label: 'Octopus Go',
	shortLabel: 'Octopus Go',
	description: 'Four cheaper hours every night, 00:30–04:30.',
	cheapLabel: 'Off-peak',
	expensiveLabel: 'Peak',
	importLabel: 'Octopus Go',
	export: null,
	window: OCTOPUS_GO_WINDOW,
	windowLabel: '00:30 – 04:30',
	classifyOffPeak: fixedWindowClassify(OCTOPUS_GO_WINDOW),
	status: fixedWindowStatus(OCTOPUS_GO_WINDOW),
	matches: matchesOctopusGo
};

const agile: TariffFamilyConfig = {
	id: 'agile',
	label: 'Agile Octopus',
	shortLabel: 'Agile',
	description: 'Half-hourly wholesale prices that change every day.',
	cheapLabel: 'Cheaper',
	expensiveLabel: 'Pricier',
	importLabel: 'Agile import',
	export: {
		label: 'Agile Outgoing',
		matches: (product) =>
			!product.is_business &&
			isExportProduct(product) &&
			AGILE_OUTGOING_PATTERN.test(product.display_name)
	},
	window: null,
	windowLabel: null,
	classifyOffPeak: classifyRelativeOffPeak,
	status: getSlotStatus,
	matches: matchesPattern(AGILE_PATTERN)
};

export const TARIFF_FAMILIES: Record<TariffFamily, TariffFamilyConfig> = {
	'intelligent-go': intelligentGo,
	'octopus-go': octopusGo,
	agile
};

export const TARIFF_FAMILY_LIST: readonly TariffFamilyConfig[] = [intelligentGo, octopusGo, agile];

export function getFamilyConfig(id: TariffFamily): TariffFamilyConfig {
	return TARIFF_FAMILIES[id];
}
