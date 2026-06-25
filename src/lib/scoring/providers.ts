import type { EmbeddingProvider, EmbeddingProviderMetadata } from './semantic';

export type LazyEmbeddingProviderLoader = () => EmbeddingProvider | Promise<EmbeddingProvider>;

export type EndpointEmbeddingResponse = EmbeddingProviderMetadata & {
	embeddings: number[][];
};

export type EndpointEmbeddingProviderOptions = {
	endpoint: string | URL;
	model?: string;
	headers?: Record<string, string>;
	fetch?: typeof fetch;
};

export function createEndpointEmbeddingProvider(
	options: EndpointEmbeddingProviderOptions
): EmbeddingProvider {
	let metadata: EmbeddingProviderMetadata = {
		model: options.model
	};

	return {
		get metadata() {
			return metadata;
		},
		async embed(texts) {
			const fetcher = options.fetch ?? globalThis.fetch;
			if (typeof fetcher !== 'function') {
				throw new Error('Fetch API is unavailable for endpoint embeddings.');
			}

			const response = await fetcher(String(options.endpoint), {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					...options.headers
				},
				body: JSON.stringify({
					texts,
					...(options.model ? { model: options.model } : {})
				})
			});

			if (!response.ok) {
				throw new Error(`Embedding endpoint failed with HTTP ${response.status}.`);
			}

			const payload = (await response.json()) as Partial<EndpointEmbeddingResponse>;
			if (!Array.isArray(payload.embeddings)) {
				throw new Error('Embedding endpoint response is missing embeddings.');
			}

			metadata = {
				model: payload.model ?? options.model,
				dimensions: payload.dimensions,
				normalized: payload.normalized
			};

			return payload.embeddings;
		}
	};
}

export function createLazyEmbeddingProvider(
	loader: LazyEmbeddingProviderLoader,
	metadata: EmbeddingProviderMetadata = {}
): EmbeddingProvider {
	let provider: EmbeddingProvider | undefined;
	let loading: Promise<EmbeddingProvider> | undefined;

	async function loadProvider(): Promise<EmbeddingProvider> {
		if (provider) return provider;

		loading ??= Promise.resolve(loader()).then((loadedProvider) => {
			provider = loadedProvider;
			return loadedProvider;
		});

		try {
			return await loading;
		} catch (error) {
			loading = undefined;
			throw error;
		}
	}

	return {
		get metadata() {
			return {
				...metadata,
				...provider?.metadata
			};
		},
		async embed(texts) {
			const loadedProvider = await loadProvider();
			return loadedProvider.embed(texts);
		}
	};
}
