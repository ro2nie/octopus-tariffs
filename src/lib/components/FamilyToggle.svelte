<script lang="ts">
	import { TARIFF_FAMILY_LIST } from '#lib/octopus/families';
	import type { TariffFamily } from '#lib/octopus/types';

	interface Props {
		value: TariffFamily;
		disabled?: boolean;
		onChange: (family: TariffFamily) => void;
	}

	let { value, disabled = false, onChange }: Props = $props();
</script>

<div class="toggle" role="radiogroup" aria-label="Tariff family">
	{#each TARIFF_FAMILY_LIST as family (family.id)}
		<button
			type="button"
			role="radio"
			aria-checked={family.id === value}
			class:active={family.id === value}
			{disabled}
			title={family.description}
			onclick={() => onChange(family.id)}
		>
			{family.shortLabel}
		</button>
	{/each}
</div>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px;
		border-radius: 999px;
		background: rgba(10, 14, 30, 0.72);
		border: 1px solid var(--panel-border-strong);
	}

	button {
		border: none;
		background: transparent;
		color: var(--text-muted);
		border-radius: 999px;
		padding: 7px 14px;
		font-size: 0.85rem;
		font-weight: 550;
		white-space: nowrap;
		transition:
			color 0.2s,
			background 0.2s;
	}

	button:hover:not(:disabled):not(.active) {
		color: var(--text);
	}

	button.active {
		color: #0b0618;
		background: linear-gradient(135deg, var(--primary-soft), var(--accent));
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
</style>
