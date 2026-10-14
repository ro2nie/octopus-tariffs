import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ProductSelect from './ProductSelect.svelte';
import type { OctopusProductSummary } from '#lib/octopus/types';

function product(code: string, display_name: string): OctopusProductSummary {
	return {
		code,
		full_name: display_name,
		display_name,
		is_variable: false,
		is_green: false,
		is_prepay: false,
		is_business: false,
		available_from: '2026-01-01T00:00:00Z',
		available_to: null
	};
}

const products = [
	product('IOG-A', 'Intelligent Octopus Go 12M Fixed'),
	product('IOG-B', 'Intelligent Octopus Go 12M Fixed - EV Saver')
];

describe('ProductSelect', () => {
	it('renders an option per product and reports changes', async () => {
		const onChange = vi.fn();
		render(ProductSelect, { products, value: 'IOG-A', onChange });

		const select = screen.getByRole('combobox') as HTMLSelectElement;
		expect(select.options).toHaveLength(2);
		expect(select.value).toBe('IOG-A');

		await fireEvent.change(select, { target: { value: 'IOG-B' } });
		expect(onChange).toHaveBeenCalledWith('IOG-B');
	});

	it('renders nothing with a single product', () => {
		render(ProductSelect, { products: [products[0]], value: 'IOG-A', onChange: vi.fn() });
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	});
});
