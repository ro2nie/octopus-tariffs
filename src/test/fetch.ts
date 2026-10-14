import { vi } from 'vitest';
import type { FetchLike } from '#lib/octopus/client';

/** Build a `Response` with a JSON body. */
export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

/**
 * Create a fetch-like mock that returns the first JSON body whose URL matches a
 * substring key. Records every requested URL for assertions.
 */
export function createFetchMock(routes: Record<string, unknown | (() => unknown)>): {
	fetchFn: FetchLike;
	calls: string[];
} {
	const calls: string[] = [];

	const fetchFn: FetchLike = vi.fn(async (url: string) => {
		calls.push(url);
		const match = Object.keys(routes).find((key) => url.includes(key));
		if (!match) {
			return jsonResponse({ detail: 'Not found' }, 404);
		}
		const value = routes[match];
		const body = typeof value === 'function' ? (value as () => unknown)() : value;
		return jsonResponse(body);
	}) as unknown as FetchLike;

	return { fetchFn, calls };
}
