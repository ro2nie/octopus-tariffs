<script lang="ts">
	import { onMount } from 'svelte';
	import { TariffStore, REFRESH_INTERVAL_MS } from '#lib/state/tariff.svelte';
	import { getCurrentSlot, getOffPeakStatus, priceBounds } from '#lib/octopus/schedule';
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

	let showConnect = $derived(editing || !store.hasPostcode);

	let slots = $derived(store.prices?.slots ?? []);
	let currentSlot = $derived(getCurrentSlot(slots, now));
	let offPeak = $derived(getOffPeakStatus(now));
	let bounds = $derived(priceBounds(slots));
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
	<title>Intelligent Octopus Go · Live Prices</title>
</svelte:head>

{#if showConnect}
	<div class="connect">
		<div class="connect-card panel">
			<div class="connect-head">
				<span class="orb" aria-hidden="true"></span>
				<div>
					<h1>Intelligent Octopus Go</h1>
					<p>Live half-hourly unit rates for your region.</p>
				</div>
			</div>

			<PostcodeForm initial={store.postcode} busy={loading} onSubmit={submitPostcode} />

			{#if store.error}
				<ErrorBanner message={store.error} />
			{/if}

			<ul class="features">
				<li>Live current price with off-peak countdown</li>
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
			<div class="left">
				{#if currentSlot}
					<CurrentPriceCard
						slot={currentSlot}
						status={offPeak}
						{now}
						standingCharge={store.prices?.standingChargeIncVat ?? null}
					/>
				{:else}
					<section class="panel skeleton" aria-busy="true">Loading live prices…</section>
				{/if}

				<div class="stats">
					<StatTile label="Peak rate" value={formatPrice(bounds.max)} tone="peak" />
					<StatTile label="Off-peak rate" value={formatPrice(bounds.min)} tone="offpeak" />
					<StatTile
						label="Standing charge"
						value={formatStandingCharge(store.prices?.standingChargeIncVat ?? null)}
					/>
					<StatTile label="Daily window" value="23:30 – 05:30" hint="every night" />
				</div>
			</div>

			<section class="panel chart-panel" aria-label="Today's price curve">
				<header class="chart-head">
					<div>
						<span class="eyebrow">Today's curve</span>
						<h2>{store.prices ? formatDay(new Date(`${store.prices.date}T12:00:00Z`)) : '—'}</h2>
					</div>
					<div class="legend">
						<span class="legend-item"><i class="swatch offpeak"></i>Off-peak</span>
						<span class="legend-item"><i class="swatch now"></i>Now</span>
					</div>
				</header>

				{#if slots.length > 0}
					<PriceChart {slots} {now} height={420} />
				{:else}
					<div class="chart-skeleton" aria-busy="true">Fetching today's rates…</div>
				{/if}

				<footer class="chart-foot">
					<span>{store.prices?.productName ?? ''}</span>
					<span class="mono">{store.prices?.tariffCode ?? ''}</span>
				</footer>
			</section>
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

	.grid {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(320px, 400px) 1fr;
		gap: 22px;
		align-items: stretch;
		min-height: 0;
	}

	.left {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.chart-panel {
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

	.swatch.now {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
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
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
