<script lang="ts">
	interface Props {
		label: string;
		value: string;
		hint?: string;
		tone?: 'default' | 'offpeak' | 'peak' | 'muted';
	}

	let { label, value, hint = '', tone = 'default' }: Props = $props();
</script>

<div class="tile {tone}">
	<span class="label">{label}</span>
	<span class="value tabular">{value}</span>
	{#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 18px;
		border-radius: var(--radius-sm);
		background: rgba(12, 16, 33, 0.55);
		border: 1px solid var(--panel-border);
	}

	.label {
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.value {
		font-size: 1.5rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.hint {
		font-size: 0.78rem;
		color: var(--text-faint);
	}

	.offpeak .value {
		color: var(--offpeak);
	}

	.peak .value {
		color: var(--peak);
	}

	.muted .value {
		color: var(--text-muted);
	}
</style>
