<script lang="ts">
	import type { PriceSlot } from '#lib/octopus/types';
	import type { OffPeakStatus } from '#lib/octopus/schedule';
	import { formatDuration, formatPriceValue, minutesBetween } from '#lib/utils/format';
	import { formatTime } from '#lib/utils/time';

	interface Props {
		slot: PriceSlot;
		status: OffPeakStatus;
		now: Date;
		standingCharge: number | null;
		cheapLabel?: string;
		expensiveLabel?: string;
		eyebrow?: string;
		variant?: 'import' | 'export';
	}

	let {
		slot,
		status,
		now,
		standingCharge,
		cheapLabel = 'Off-peak',
		expensiveLabel = 'Peak',
		eyebrow = 'Right now',
		variant = 'import'
	}: Props = $props();

	let minutesToChange = $derived(Math.max(0, Math.round(minutesBetween(now, status.changesAt))));
	let untilText = $derived(formatDuration(minutesToChange));
	let atText = $derived(formatTime(status.changesAt));
</script>

<section class="current panel" class:export={variant === 'export'} aria-label="Current unit rate">
	<div class="glow" class:offpeak={status.offPeak} aria-hidden="true"></div>

	<div class="head">
		<span class="eyebrow">{eyebrow}</span>
		<span class="pill" class:offpeak={status.offPeak} class:peak={!status.offPeak}>
			<span class="dot" aria-hidden="true"></span>
			{status.offPeak ? cheapLabel : expensiveLabel}
		</span>
	</div>

	<div class="price tabular">
		<span class="value">{formatPriceValue(slot.priceIncVat)}</span>
		<span class="unit">p<small>/kWh</small></span>
	</div>

	<div class="meta">
		<div class="meta-row">
			<span class="meta-label">{status.label}</span>
			<span class="meta-value tabular">in {untilText}</span>
		</div>
		<div class="meta-row muted">
			<span class="meta-label">Changes at</span>
			<span class="meta-value tabular">{atText}</span>
		</div>
		{#if standingCharge != null}
			<div class="meta-row muted">
				<span class="meta-label">Standing charge</span>
				<span class="meta-value tabular">{standingCharge.toFixed(2)}p / day</span>
			</div>
		{/if}
	</div>
</section>

<style>
	.current {
		position: relative;
		overflow: hidden;
		padding: 26px 28px 24px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.glow {
		position: absolute;
		inset: -40% -20% auto;
		height: 180px;
		background: radial-gradient(closest-side, rgba(251, 113, 133, 0.35), transparent);
		filter: blur(20px);
		pointer-events: none;
		transition: background 0.6s ease;
	}

	.glow.offpeak {
		background: radial-gradient(closest-side, rgba(52, 211, 153, 0.38), transparent);
	}

	.current.export .glow {
		background: radial-gradient(closest-side, rgba(245, 158, 11, 0.34), transparent);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.eyebrow {
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.pill .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	.pill.offpeak {
		color: var(--offpeak);
		background: var(--offpeak-soft);
	}

	.pill.peak {
		color: var(--peak);
		background: var(--peak-soft);
	}

	.price {
		display: flex;
		align-items: baseline;
		gap: 10px;
		line-height: 0.9;
	}

	.value {
		font-size: clamp(4rem, 11vw, 7rem);
		font-weight: 750;
		letter-spacing: -0.04em;
		background: linear-gradient(120deg, #ffffff, var(--primary-soft) 70%, var(--accent));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.current.export .value {
		background: linear-gradient(120deg, #ffffff, #fcd34d 70%, var(--export));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.unit {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.unit small {
		font-size: 0.85rem;
		color: var(--text-faint);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-top: 1px solid var(--panel-border);
		padding-top: 16px;
	}

	.meta-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
	}

	.meta-label {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.meta-value {
		font-weight: 600;
	}

	.meta-row.muted .meta-label,
	.meta-row.muted .meta-value {
		color: var(--text-faint);
		font-weight: 500;
		font-size: 0.9rem;
	}
</style>
