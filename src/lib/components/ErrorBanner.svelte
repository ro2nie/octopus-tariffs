<script lang="ts">
	interface Props {
		message: string;
		onRetry?: () => void;
	}

	let { message, onRetry }: Props = $props();
</script>

<div class="banner" role="alert">
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	<span>{message}</span>
	{#if onRetry}
		<button type="button" onclick={onRetry}>Retry</button>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		border-radius: var(--radius-sm);
		background: rgba(248, 113, 113, 0.12);
		border: 1px solid rgba(248, 113, 113, 0.35);
		color: #fecaca;
		font-size: 0.92rem;
	}

	svg {
		width: 20px;
		height: 20px;
		flex: none;
	}

	span {
		flex: 1;
	}

	button {
		border: 1px solid rgba(248, 113, 113, 0.5);
		background: transparent;
		color: #fecaca;
		border-radius: 10px;
		padding: 7px 14px;
		font-weight: 600;
	}

	button:hover {
		background: rgba(248, 113, 113, 0.18);
	}
</style>
