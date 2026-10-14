import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import PostcodeForm from './PostcodeForm.svelte';

function submit(container: HTMLElement) {
	const form = container.querySelector('form');
	if (!form) throw new Error('form not found');
	return fireEvent.submit(form);
}

describe('PostcodeForm', () => {
	it('submits a normalised, formatted postcode', async () => {
		const onSubmit = vi.fn();
		const { container } = render(PostcodeForm, { onSubmit });

		const input = screen.getByLabelText(/uk postcode/i);
		await fireEvent.input(input, { target: { value: 'sw1a1aa' } });
		await submit(container);

		expect(onSubmit).toHaveBeenCalledWith('SW1A 1AA');
	});

	it('rejects an invalid postcode without submitting', async () => {
		const onSubmit = vi.fn();
		const { container } = render(PostcodeForm, { onSubmit });

		const input = screen.getByLabelText(/uk postcode/i);
		await fireEvent.input(input, { target: { value: 'not a postcode' } });
		await submit(container);

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent(/valid uk postcode/i);
	});

	it('disables the button while busy', () => {
		render(PostcodeForm, { onSubmit: vi.fn(), busy: true });
		expect(screen.getByRole('button')).toBeDisabled();
	});
});
