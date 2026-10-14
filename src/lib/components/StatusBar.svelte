<script lang="ts">
	import type { OctopusProductSummary, RegionCode } from '#lib/octopus/types';
	import type { LoadStatus } from '#lib/state/tariff.svelte';
	import { formatClock } from '#lib/utils/time';
	import ProductSelect from './ProductSelect.svelte';

	interface Props {
		products: OctopusProductSummary[];
		productCode: string;
		onSelectProduct: (code: string) => void;
		region: RegionCode | null;
		status: LoadStatus;
		lastUpdated: Date | null;
		nextRefreshAt: Date | null;
		now: Date;
		onRefresh: () => void;
		onFullscreen: () => void;
		onEditPostcode: () => void;
	}

	let {
		products,
		productCode,
		onSelectProduct,
		region,
		status,
		lastUpdated,
		nextRefreshAt,
		now,
		onRefresh,
		onFullscreen,
		onEditPostcode
	}: Props = $props();

	let countdown = $derived.by(() => {
		if (!nextRefreshAt) return null;
		const seconds = Math.max(0, Math.round((nextRefreshAt.getTime() - now.getTime()) / 1000));
		const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
		const ss = String(seconds % 60).padStart(2, '0');
		return `${mm}:${ss}`;
	});
</script>

<header class="bar">
	<div class="brand">
		<span class="orb" aria-hidden="true"></span>
		<div class="brand-text">
			<h1>Intelligent Octopus Go</h1>
			<span class="tagline">
				{#if region}Region {region}{/if}
				{#if lastUpdated}
					· Updated {formatClock(lastUpdated)}{/if}
			</span>
		</div>
	</div>

	<div class="actions">
		<ProductSelect
			{products}
			value={productCode}
			onChange={onSelectProduct}
			disabled={status === 'loading'}
		/>

		<span class="live" class:busy={status === 'loading'} title={status}>
			<span class="dot" class:pulse={status !== 'error'} aria-hidden="true"></span>
			{#if status === 'loading'}
				Syncing
			{:else if countdown}
				Next in <span class="tabular">{countdown}</span>
			{:else}
				Live
			{/if}
		</span>

		<button
			class="icon"
			type="button"
			onclick={onRefresh}
			title="Refresh now"
			aria-label="Refresh now"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>

		<button
			class="icon"
			type="button"
			onclick={onEditPostcode}
			title="Change postcode"
			aria-label="Change postcode"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
				<circle cx="12" cy="10" r="2.5" fill="currentColor" />
			</svg>
		</button>

		<button
			class="icon"
			type="button"
			onclick={onFullscreen}
			title="Toggle fullscreen"
			aria-label="Toggle fullscreen"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	</div>
</header>

<style>
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		flex-wrap: wrap;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.orb {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background:
			radial-gradient(circle at 32% 28%, #fff 0 6%, transparent 40%),
			conic-gradient(from 200deg, var(--primary), var(--accent), var(--offpeak), var(--primary));
		box-shadow: 0 0 26px -6px var(--primary-soft);
	}

	.brand-text {
		display: flex;
		flex-direction: column;
	}

	h1 {
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.tagline {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.live {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 999px;
		background: rgba(10, 14, 30, 0.6);
		border: 1px solid var(--panel-border);
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.live .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--offpeak);
		box-shadow: 0 0 10px var(--offpeak);
	}

	.live.busy .dot {
		background: var(--warning);
		box-shadow: 0 0 10px var(--warning);
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: rgba(10, 14, 30, 0.6);
		border: 1px solid var(--panel-border);
		color: var(--text-muted);
		transition:
			color 0.2s,
			border-color 0.2s,
			transform 0.15s;
	}

	.icon:hover {
		color: var(--text);
		border-color: var(--panel-border-strong);
		transform: translateY(-1px);
	}

	.icon svg {
		width: 19px;
		height: 19px;
	}
</style>
