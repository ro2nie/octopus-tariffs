import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement matchMedia, which components may query for reduced
// motion or responsive behaviour.
if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}));
}

// jsdom does not implement ResizeObserver, which LayerChart relies on.
if (typeof globalThis.ResizeObserver === 'undefined') {
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
