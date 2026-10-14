<script lang="ts">
	import { Area, AreaChart, Axis, Highlight, Layer, Tooltip } from 'layerchart';
	import { curveStepAfter } from 'd3-shape';
	import type { PriceSlot } from '#lib/octopus/types';
	import { getCurrentSlot } from '#lib/octopus/schedule';
	import { getZonedParts, formatTime, zonedTimeToUtc } from '#lib/utils/time';
	import { formatPriceValue } from '#lib/utils/format';

	interface Props {
		slots: PriceSlot[];
		now: Date;
		height?: number;
		variant?: 'import' | 'export';
		label?: string;
		cheapLabel?: string;
		expensiveLabel?: string;
	}

	let {
		slots,
		now,
		height = 360,
		variant = 'import',
		label = 'Import',
		cheapLabel = 'Cheaper',
		expensiveLabel = 'Pricier'
	}: Props = $props();

	let isExport = $derived(variant === 'export');
	let gradientId = $derived(isExport ? 'export-fill' : 'price-fill');
	let lineColor = $derived(isExport ? 'var(--export-line)' : 'var(--chart-line)');

	interface ChartPoint {
		start: Date;
		end: Date;
		price: number;
		offPeak: boolean;
	}

	let points = $derived<ChartPoint[]>(
		slots.map((slot) => ({
			start: slot.start,
			end: slot.end,
			price: slot.priceIncVat,
			offPeak: slot.offPeak
		}))
	);

	let dayStart = $derived(slots[0]?.start ?? now);
	let dayEnd = $derived(slots.at(-1)?.end ?? now);

	let xDomain = $derived([dayStart, dayEnd] as [Date, Date]);
	let yMax = $derived.by(() => {
		const max = Math.max(...slots.map((slot) => slot.priceIncVat), 0);
		return Math.ceil((max * 1.18) / 5) * 5 || 5;
	});
	// Prices can go negative (Agile), so the axis may need to extend below zero.
	let yMin = $derived.by(() => {
		if (!slots.length) return 0;
		const min = Math.min(...slots.map((slot) => slot.priceIncVat), 0);
		return Math.floor((min * 1.1) / 5) * 5;
	});
	let yDomain = $derived([yMin, yMax] as [number, number]);

	// X ticks every three hours at the top of the hour.
	let hourTicks = $derived.by(() => {
		const { year, month, day } = getZonedParts(dayStart);
		const hours = [0, 3, 6, 9, 12, 15, 18, 21];
		return hours.map((hour) => zonedTimeToUtc({ year, month, day, hour, minute: 0 }));
	});

	// Contiguous off-peak ranges, drawn as a soft background band. Only meaningful
	// for the import series: for export, a cheaper slot is not a "good" one.
	let offPeakBands = $derived.by(() => {
		if (isExport) return [];
		const bands: { start: Date; end: Date }[] = [];
		for (const slot of slots) {
			if (!slot.offPeak) continue;
			const last = bands.at(-1);
			if (last && last.end.getTime() === slot.start.getTime()) {
				last.end = slot.end;
			} else {
				bands.push({ start: slot.start, end: slot.end });
			}
		}
		return bands;
	});

	let currentSlot = $derived(getCurrentSlot(slots, now));
	let currentPrice = $derived(currentSlot?.priceIncVat ?? 0);

	function formatHour(value: unknown): string {
		const date = value instanceof Date ? value : new Date(value as number);
		const { hour } = getZonedParts(date);
		return `${String(hour).padStart(2, '0')}:00`;
	}

	function formatRate(value: unknown): string {
		return `${Math.round(Number(value))}p`;
	}
</script>

{#if points.length > 0}
	<div class="chart" style="--chart-height: {height}px">
		<AreaChart
			data={points}
			x="start"
			y="price"
			{xDomain}
			{yDomain}
			padding={{ top: 18, right: 24, bottom: 34, left: 54 }}
			{height}
		>
			{#snippet children({ context })}
				<Layer>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="0%"
								stop-color={isExport ? 'var(--chart-export-fill-from)' : 'var(--chart-fill-from)'}
							/>
							<stop
								offset="100%"
								stop-color={isExport ? 'var(--chart-export-fill-to)' : 'var(--chart-fill-to)'}
							/>
						</linearGradient>
					</defs>

					{#each offPeakBands as band (band.start.getTime())}
						<rect
							x={context.xScale(band.start)}
							y={0}
							width={Math.max(0, context.xScale(band.end) - context.xScale(band.start))}
							height={context.height}
							fill="var(--offpeak-soft)"
						/>
					{/each}

					<Axis placement="left" grid rule format={formatRate} />
					<Axis placement="bottom" rule ticks={hourTicks} format={formatHour} />

					<Area
						curve={curveStepAfter}
						fill={`url(#${gradientId})`}
						line={{ stroke: lineColor, strokeWidth: isExport ? 2 : 2.5 }}
					/>

					<!-- Current time marker -->
					<line
						x1={context.xScale(now)}
						x2={context.xScale(now)}
						y1={0}
						y2={context.height}
						stroke="var(--accent)"
						stroke-width={1.5}
						stroke-dasharray="4 5"
						opacity={0.8}
					/>
					<circle
						cx={context.xScale(now)}
						cy={context.yScale(currentPrice)}
						r={6}
						fill="var(--accent)"
						stroke="var(--bg-0)"
						stroke-width={2.5}
					/>

					<Highlight points lines />
				</Layer>

				<Tooltip.Root>
					{#snippet children({ data })}
						<Tooltip.Header>
							{formatTime(data.start)} – {formatTime(data.end)}
						</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								label={isExport
									? label
									: `${label} · ${data.offPeak ? cheapLabel : expensiveLabel}`}
								value={`${formatPriceValue(data.price)}p/kWh`}
								color={lineColor}
							/>
						</Tooltip.List>
					{/snippet}
				</Tooltip.Root>
			{/snippet}
		</AreaChart>
	</div>
{/if}

<style>
	.chart {
		width: 100%;
		height: var(--chart-height);
		--color-surface-100: var(--panel-solid);
		--color-surface-content: var(--text);
	}

	.chart :global(svg) {
		overflow: visible;
	}
</style>
