/**
 * A tiny, dependency-free client for the public Octopus Energy REST API.
 *
 * All endpoints used by this app are unauthenticated and CORS-enabled, so they
 * can be called straight from the browser. `fetch` is injected everywhere to
 * keep the rest of the domain layer trivially unit-testable.
 */

export const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1';

/** Signature of the fetch implementation the domain layer depends on. */
export type FetchLike = (input: string) => Promise<Response>;

export class OctopusApiError extends Error {
	readonly status: number | undefined;
	readonly url: string;

	constructor(message: string, options: { status?: number; url: string; cause?: unknown }) {
		super(message, { cause: options.cause });
		this.name = 'OctopusApiError';
		this.status = options.status;
		this.url = options.url;
	}
}

interface RequestOptions {
	fetchFn?: FetchLike;
	/** Number of retries for transient failures (network, 429, 5xx). */
	retries?: number;
	signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(new DOMException('Aborted', 'AbortError'));
			},
			{ once: true }
		);
	});
}

/**
 * Perform a GET request against the Octopus API and parse the JSON body.
 *
 * The API is occasionally rate-limited, so transient failures are retried with
 * exponential backoff. A 4xx (other than 429) is considered permanent.
 */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { fetchFn = fetch, retries = 2, signal } = options;
	const url = path.startsWith('http') ? path : `${OCTOPUS_API_BASE}${path}`;

	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetchFn(url);
			if (!response.ok) {
				if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
					await sleep(250 * 2 ** attempt, signal);
					continue;
				}
				throw new OctopusApiError(`Request failed with status ${response.status}`, {
					status: response.status,
					url
				});
			}
			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw error;
			}
			lastError = error;
			if (error instanceof OctopusApiError) throw error;
			if (attempt < retries) {
				await sleep(250 * 2 ** attempt, signal);
				continue;
			}
		}
	}

	throw new OctopusApiError('Network request to Octopus failed', { url, cause: lastError });
}
