<script lang="ts">
	import { isValidPostcode, normalizePostcode, formatPostcode } from '#lib/octopus/postcode';

	interface Props {
		initial?: string;
		busy?: boolean;
		variant?: 'hero' | 'inline';
		onSubmit: (postcode: string) => void;
	}

	let { initial = '', busy = false, variant = 'hero', onSubmit }: Props = $props();

	// Seed once from the initial value; subsequent edits are owned by this component.
	// svelte-ignore state_referenced_locally
	let value = $state(initial);
	let touched = $state(false);

	let normalized = $derived(normalizePostcode(value));
	let valid = $derived(isValidPostcode(normalized));
	let showError = $derived(touched && normalized.length > 0 && !valid);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if (!valid) return;
		onSubmit(formatPostcode(normalized));
	}
</script>

<form class="postcode {variant}" onsubmit={submit} novalidate>
	<label class="field">
		<span class="eyebrow">UK postcode</span>
		<div class="input-row">
			<input
				type="text"
				name="postcode"
				inputmode="text"
				autocomplete="postal-code"
				autocapitalize="characters"
				spellcheck="false"
				placeholder="e.g. SW1A 1AA"
				aria-label="UK postcode"
				aria-invalid={showError}
				bind:value
				onblur={() => (touched = true)}
			/>
			<button type="submit" disabled={busy || (touched && !valid)}>
				{#if busy}
					<span class="spinner" aria-hidden="true"></span>
					Looking up…
				{:else}
					Track my tariff
				{/if}
			</button>
		</div>
	</label>

	{#if showError}
		<p class="error" role="alert">That doesn't look like a valid UK postcode.</p>
	{:else}
		<p class="hint">
			Your postcode is stored only in this browser and never sent anywhere but Octopus.
		</p>
	{/if}
</form>

<style>
	.postcode {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
	}

	.eyebrow {
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.input-row {
		display: flex;
		gap: 12px;
	}

	input {
		flex: 1;
		min-width: 0;
		background: rgba(6, 9, 20, 0.72);
		border: 1px solid var(--panel-border-strong);
		border-radius: var(--radius-sm);
		padding: 16px 18px;
		font-size: 1.15rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	input::placeholder {
		text-transform: none;
		letter-spacing: normal;
		color: var(--text-faint);
	}

	input:focus-visible {
		border-color: var(--primary-soft);
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.25);
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		white-space: nowrap;
		border: none;
		border-radius: var(--radius-sm);
		padding: 16px 24px;
		font-weight: 600;
		color: #0b0618;
		background: linear-gradient(135deg, var(--primary-soft), var(--accent));
		box-shadow: 0 12px 30px -12px rgba(139, 92, 246, 0.8);
		transition:
			transform 0.15s,
			filter 0.2s;
	}

	button:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.05);
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.hint,
	.error {
		font-size: 0.85rem;
		color: var(--text-faint);
	}

	.error {
		color: var(--danger);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid rgba(11, 6, 24, 0.4);
		border-top-color: #0b0618;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.inline input,
	.inline button {
		padding: 12px 16px;
		font-size: 1rem;
	}
</style>
