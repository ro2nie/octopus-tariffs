import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import FamilyToggle from './FamilyToggle.svelte';

describe('FamilyToggle', () => {
	it('renders every family and marks the active one', () => {
		render(FamilyToggle, { value: 'intelligent-go', onChange: vi.fn() });

		const options = screen.getAllByRole('radio');
		expect(options).toHaveLength(3);
		expect(screen.getByRole('radio', { name: 'Intelligent Go' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		expect(screen.getByRole('radio', { name: 'Octopus Go' })).toHaveAttribute(
			'aria-checked',
			'false'
		);
		expect(screen.getByRole('radio', { name: 'Agile' })).toHaveAttribute('aria-checked', 'false');
	});

	it('reports a family change', async () => {
		const onChange = vi.fn();
		render(FamilyToggle, { value: 'intelligent-go', onChange });

		await fireEvent.click(screen.getByRole('radio', { name: 'Agile' }));
		expect(onChange).toHaveBeenCalledWith('agile');

		await fireEvent.click(screen.getByRole('radio', { name: 'Octopus Go' }));
		expect(onChange).toHaveBeenCalledWith('octopus-go');
	});

	it('disables the options while busy', () => {
		render(FamilyToggle, { value: 'agile', onChange: vi.fn(), disabled: true });
		for (const option of screen.getAllByRole('radio')) {
			expect(option).toBeDisabled();
		}
	});
});
