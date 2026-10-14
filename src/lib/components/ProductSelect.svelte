<script lang="ts">
	import type { OctopusProductSummary } from '#lib/octopus/types';

	interface Props {
		products: OctopusProductSummary[];
		value: string;
		disabled?: boolean;
		onChange: (code: string) => void;
	}

	let { products, value, disabled = false, onChange }: Props = $props();
</script>

{#if products.length > 1}
	<label class="select">
		<span class="visually-hidden">Tariff</span>
		<select
			{disabled}
			{value}
			onchange={(event) => onChange((event.currentTarget as HTMLSelectElement).value)}
		>
			{#each products as product (product.code)}
				<option value={product.code}>{product.display_name}</option>
			{/each}
		</select>
		<svg viewBox="0 0 24 24" aria-hidden="true" class="chevron">
			<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
		</svg>
	</label>
{/if}

<style>
	.select {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	select {
		appearance: none;
		background: rgba(10, 14, 30, 0.72);
		border: 1px solid var(--panel-border-strong);
		border-radius: 999px;
		padding: 9px 38px 9px 16px;
		font-size: 0.9rem;
		font-weight: 550;
		color: var(--text);
		max-width: 22rem;
		text-overflow: ellipsis;
		transition: border-color 0.2s;
	}

	select:hover:not(:disabled),
	select:focus-visible {
		border-color: var(--primary-soft);
		outline: none;
	}

	select:disabled {
		opacity: 0.6;
	}

	.chevron {
		position: absolute;
		right: 12px;
		width: 16px;
		height: 16px;
		color: var(--text-muted);
		pointer-events: none;
	}
</style>
