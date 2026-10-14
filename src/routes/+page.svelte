<script lang="ts">
	import { onMount } from 'svelte';
	import { TariffStore, REFRESH_INTERVAL_MS } from '#lib/state/tariff.svelte';
	import { getCurrentSlot, priceBounds } from '#lib/octopus/schedule';
	import { getFamilyConfig } from '#lib/octopus/families';
	import { formatPrice, formatStandingCharge } from '#lib/utils/format';
	import { formatDay } from '#lib/utils/time';
	import StatusBar from '#lib/components/StatusBar.svelte';
	import CurrentPriceCard from '#lib/components/CurrentPriceCard.svelte';
	import PriceChart from '#lib/components/PriceChart.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import ErrorBanner from '#lib/components/ErrorBanner.svelte';
	import PostcodeForm from '#lib/components/PostcodeForm.svelte';

	const store = new TariffStore();

	let now = $state(new Date());
	let editing = $state(false);
	let started = $state(false);
	let showExport = $state(true);

	let showConnect = $derived(editing || !store.hasPostcode);

	let slots = $derived(store.prices?.slots ?? []);
	let hasExport = $derived((store.outgoing?.slots.length ?? 0) > 0);
	let exportSlots = $derived(store.outgoing?.slots ?? []);
	let currentSlot = $derived(getCurrentSlot(slots, now));
	let config = $derived(getFamilyConfig(store.family));
	let priceStatus = $derived(config.status(slots, now));
	let bounds = $derived(priceBounds(slots));
	let average = $derived.by(() => {
		if (!slots.length) return null;
		return slots.reduce((sum, slot) => sum + slot.priceIncVat, 0) / slots.length;
	});

	let outgoingCurrentSlot = $derived(getCurrentSlot(exportSlots, now));
	let outgoingStatus = $derived(config.status(exportSlots, now));
	let outgoingBounds = $derived(priceBounds(exportSlots));
	let outgoingAverage = $derived.by(() => {
		if (!exportSlots.length) return null;
		return exportSlots.reduce((sum, slot) => sum + slot.priceIncVat, 0) / exportSlots.length;
	});
	let nextRefreshAt = $derived(
		store.lastUpdated ? new Date(store.lastUpdated.getTime() + REFRESH_INTERVAL_MS) : null
	);
	let loading = $derived(store.status === 'loading' && !store.prices);

	async function start() {
		if (started) return;
		started = true;
		await store.load();
	}

	function submitPostcode(postcode: string) {
		editing = false;
		store.setPostcode(postcode);
		started = false;
		start();
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen?.().catch(() => {});
		} else {
			document.exitFullscreen?.().catch(() => {});
		}
	}

	let wakeLock: { release: () => Promise<void> } | null = null;
	async function acquireWakeLock() {
		try {
			const nav = navigator as Navigator & {
				wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
			};
			wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
		} catch {
			wakeLock = null;
		}
	}

	onMount(() => {
		const tick = setInterval(() => (now = new Date()), 1000);
		const refresh = setInterval(() => store.refresh(), REFRESH_INTERVAL_MS);

		const onVisibility = () => {
			if (document.visibilityState !== 'visible') return;
			now = new Date();
			acquireWakeLock();
			if (
				store.hasPostcode &&
				(!store.lastUpdated || Date.now() - store.lastUpdated.getTime() > REFRESH_INTERVAL_MS)
			) {
				store.refresh();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);

		let idleTimer: ReturnType<typeof setTimeout>;
		const onPointer = () => {
			document.body.classList.remove('cursor-hidden');
			clearTimeout(idleTimer);
			idleTimer = setTimeout(() => document.body.classList.add('cursor-hidden'), 3000);
		};
		window.addEventListener('pointermove', onPointer);
		window.addEventListener('pointerdown', onPointer);

		acquireWakeLock();

		if (store.hasPostcode) start();
		else editing = true;

		return () => {
			clearInterval(tick);
			clearInterval(refresh);
			clearTimeout(idleTimer);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('pointerdown', onPointer);
			document.body.classList.remove('cursor-hidden');
			wakeLock?.release().catch(() => {});
		};
	});
</script>

<svelte:head>
	<title>Octopus Energy · Live Prices</title>
</svelte:head>

{#if showConnect}
	<div class="connect">
		<div class="connect-card panel">
			<div class="connect-head">
				<span class="orb" aria-hidden="true"></span>
				<div>
					<h1>Octopus Energy</h1>
					<p>Live half-hourly unit rates for your region.</p>
				</div>
			</div>

			<PostcodeForm initial={store.postcode} busy={loading} onSubmit={submitPostcode} />

			{#if store.error}
				<ErrorBanner message={store.error} />
			{/if}

			<ul class="features">
				<li>Intelligent Octopus Go, Octopus Go and Agile Octopus import tariffs</li>
				<li>Live current price with a countdown to the next change</li>
				<li>Whole-day price curve, refreshed every 10 minutes</li>
				<li>Built for always-on kiosk displays</li>
			</ul>

			{#if store.hasPostcode}
				<button class="cancel" type="button" onclick={() => (editing = false)}>
					Cancel and return to dashboard
				</button>
			{/if}
		</div>
	</div>
{:else}
	<div class="app">
		<StatusBar
			products={store.products}
			productCode={store.productCode}
			onSelectProduct={(code) => store.selectProduct(code)}
			family={store.family}
			onSelectFamily={(family) => store.setFamily(family)}
			region={store.region}
			status={store.status}
			lastUpdated={store.lastUpdated}
			{nextRefreshAt}
			{now}
			onRefresh={() => store.refresh()}
			onFullscreen={toggleFullscreen}
			onEditPostcode={() => (editing = true)}
		/>

		{#if store.error}
			<ErrorBanner message={store.error} onRetry={() => store.load()} />
		{/if}

		<main class="grid">
			{#snippet rateStats(
				highest: number,
				lowest: number,
				standing: number | null,
				avg: number | null
			)}
				<div class="stats">
					<StatTile label="Highest" value={formatPrice(highest)} tone="peak" />
					<StatTile label="Lowest" value={formatPrice(lowest)} tone="offpeak" />
					<StatTile label="Standing charge" value={formatStandingCharge(standing)} />
					<StatTile label="Day average" value={formatPrice(avg)} hint="across half-hour slots" />
				</div>
			{/snippet}

			<section class="block" aria-label="Imported electricity">
				<div class="block-left">
					{#if currentSlot}
						<CurrentPriceCard
							slot={currentSlot}
							status={priceStatus}
							{now}
							standingCharge={store.prices?.standingChargeIncVat ?? null}
							cheapLabel={config.cheapLabel}
							expensiveLabel={config.expensiveLabel}
						/>
					{:else}
						<section class="panel skeleton" aria-busy="true">Loading live prices…</section>
					{/if}

					{#if store.family === 'agile'}
						{@render rateStats(
							bounds.max,
							bounds.min,
							store.prices?.standingChargeIncVat ?? null,
							average
						)}
					{:else}
						<div class="stats">
							<StatTile label="Peak rate" value={formatPrice(bounds.max)} tone="peak" />
							<StatTile label="Off-peak rate" value={formatPrice(bounds.min)} tone="offpeak" />
							<StatTile
								label="Standing charge"
								value={formatStandingCharge(store.prices?.standingChargeIncVat ?? null)}
							/>
							<StatTile label="Daily window" value={config.windowLabel ?? '—'} hint="every night" />
						</div>
					{/if}
				</div>

				<div class="block-right">
					<section class="panel chart-panel" aria-label="Today's import price curve">
						<header class="chart-head">
							<div>
								<span class="eyebrow">Today's import curve</span>
								<h2>
									{store.prices ? formatDay(new Date(`${store.prices.date}T12:00:00Z`)) : '—'}
								</h2>
							</div>
							<div class="legend">
								<span class="legend-item"><i class="swatch offpeak"></i>{config.cheapLabel}</span>
								<span class="legend-item"><i class="swatch import"></i>{config.importLabel}</span>
								{#if hasExport}
									<button
										type="button"
										class="legend-item toggle"
										class:off={!showExport}
										aria-pressed={showExport}
										title="Toggle the outgoing export graph"
										onclick={() => (showExport = !showExport)}
									>
										<i class="swatch export"></i>{config.export?.label}
									</button>
								{/if}
								<span class="legend-item"><i class="swatch now"></i>Now</span>
							</div>
						</header>

						{#if slots.length > 0}
							<PriceChart
								{slots}
								{now}
								height={340}
								variant="import"
								label={config.importLabel}
								cheapLabel={config.cheapLabel}
								expensiveLabel={config.expensiveLabel}
							/>
						{:else}
							<div class="chart-skeleton" aria-busy="true">Fetching today's rates…</div>
						{/if}

						<footer class="chart-foot">
							<span>{store.prices?.productName ?? ''}</span>
							<span class="mono">{store.prices?.tariffCode ?? ''}</span>
						</footer>
					</section>
				</div>
			</section>

			{#if hasExport && showExport}
				<section class="block" aria-label="Exported electricity">
					<div class="block-left">
						{#if outgoingCurrentSlot}
							<CurrentPriceCard
								slot={outgoingCurrentSlot}
								status={outgoingStatus}
								{now}
								standingCharge={store.outgoing?.standingChargeIncVat ?? null}
								cheapLabel={config.cheapLabel}
								expensiveLabel={config.expensiveLabel}
								eyebrow="Outgoing · right now"
								variant="export"
							/>
						{/if}
						{@render rateStats(
							outgoingBounds.max,
							outgoingBounds.min,
							store.outgoing?.standingChargeIncVat ?? null,
							outgoingAverage
						)}
					</div>

					<div class="block-right">
						<section class="panel chart-panel" aria-label="Today's export price curve">
							<header class="chart-head">
								<div>
									<span class="eyebrow">Today's export curve</span>
									<h2>
										{store.outgoing ? formatDay(new Date(`${store.outgoing.date}T12:00:00Z`)) : '—'}
									</h2>
								</div>
								<div class="legend">
									<span class="legend-item"
										><i class="swatch export"></i>{config.export?.label}</span
									>
									<span class="legend-item"><i class="swatch now"></i>Now</span>
								</div>
							</header>

							<PriceChart
								slots={exportSlots}
								{now}
								height={300}
								variant="export"
								label={config.export?.label ?? 'Export'}
							/>

							<footer class="chart-foot">
								<span>{store.outgoing?.productName ?? ''}</span>
								<span class="mono">{store.outgoing?.tariffCode ?? ''}</span>
							</footer>
						</section>
					</div>
				</section>
			{/if}
		</main>

		<footer class="foot">
			<span>Prices in pence per kWh inc. VAT · Europe/London</span>
			<span>Data from the public Octopus Energy API · Not affiliated with Octopus Energy</span>
		</footer>
	</div>
{/if}

<style>
	.connect {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}

	.connect-card {
		width: min(640px, 100%);
		padding: 36px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.connect-head {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.orb {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		flex: none;
		background:
			radial-gradient(circle at 32% 28%, #fff 0 6%, transparent 40%),
			conic-gradient(from 200deg, var(--primary), var(--accent), var(--offpeak), var(--primary));
		box-shadow: 0 0 34px -6px var(--primary-soft);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.connect-head p {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.features {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}

	.features li {
		padding-left: 26px;
		position: relative;
		color: var(--text-muted);
		font-size: 0.92rem;
	}

	.features li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 6px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--offpeak), var(--accent));
		box-shadow: 0 0 12px -2px var(--offpeak);
	}

	.cancel {
		align-self: flex-start;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		padding: 0;
	}

	.cancel:hover {
		color: var(--text);
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: clamp(16px, 2.6vw, 34px);
	}

	/* Each block pairs a "right now" display with its graph. On wide screens they
	 * sit side by side; on narrow screens the pair stacks (card, stats, graph). */
	.grid {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-height: 0;
	}

	.block {
		display: grid;
		grid-template-columns: minmax(320px, 400px) 1fr;
		gap: 22px;
		align-items: stretch;
		min-width: 0;
	}

	.block-left {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}

	.block-right {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.chart-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 22px 24px 18px;
		min-width: 0;
	}

	.chart-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.eyebrow {
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.chart-head h2 {
		font-size: 1.3rem;
		font-weight: 650;
	}

	.legend {
		display: flex;
		gap: 16px;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 4px;
	}

	.swatch.offpeak {
		background: var(--offpeak-soft);
		border: 1px solid var(--offpeak);
	}

	.swatch.import {
		background: var(--chart-fill-from);
		border: 1px solid var(--chart-line);
	}

	.swatch.export {
		background: var(--export-soft);
		border: 1px solid var(--export-line);
	}

	.swatch.now {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}

	.legend-item.toggle {
		background: none;
		border: none;
		padding: 0;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.82rem;
		transition: color 0.2s;
	}

	.legend-item.toggle:hover {
		color: var(--text);
	}

	.legend-item.toggle.off {
		opacity: 0.45;
	}

	.chart-foot {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 0.76rem;
		color: var(--text-faint);
		margin-top: auto;
	}

	.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
	}

	.skeleton,
	.chart-skeleton {
		display: grid;
		place-items: center;
		min-height: 220px;
		color: var(--text-faint);
	}

	.chart-skeleton {
		flex: 1;
	}

	.foot {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	@media (max-width: 900px) {
		.block {
			grid-template-columns: 1fr;
		}
	}
</style>
