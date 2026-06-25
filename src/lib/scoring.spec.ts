import { describe, expect, it } from 'vitest';
import {
	FALLBACK_SCORING_WEIGHTS,
	SEMANTIC_SCORING_WEIGHTS,
	contentWords,
	createLazyEmbeddingProvider,
	scoreAttempt,
	scoreAttemptWithEmbeddings,
	tokenize,
	type EmbeddingProvider
} from './scoring';

describe('tokenize', () => {
	it('normalizes punctuation and casing', () => {
		expect(tokenize('Hello, WORLD!!!')).toEqual(['hello', 'world']);
	});
});

describe('contentWords', () => {
	it('drops short and stop words', () => {
		expect(contentWords('The very drunk monkey types quickly')).toEqual([
			'very',
			'drunk',
			'monkey',
			'types',
			'quickly'
		]);
	});
});

describe('scoreAttempt', () => {
	const source =
		'A tiny monkey types a meaningful sentence with strange but understandable mistakes.';

	it('exports the documented deterministic fallback weights', () => {
		expect(FALLBACK_SCORING_WEIGHTS).toEqual({
			wholeTextSimilarity: 0.25,
			contentWordCoverage: 0.35,
			chunkSimilarity: 0.25,
			lengthFitness: 0.15
		});
	});

	it('gives an exact attempt a perfect similarity score', () => {
		const score = scoreAttempt(source, source, 30);

		expect(score.overall).toBe(100);
		expect(score.effectiveWpm).toBe(score.wpm);
		expect(score.wholeTextSimilarity).toBe(100);
		expect(score.contentWordCoverage).toBe(100);
		expect(score.chunkSimilarity).toBe(100);
		expect(score.lengthFitness).toBe(100);
	});

	it('keeps typo-heavy but recognizable text above unrelated text', () => {
		const typoScore = scoreAttempt(
			source,
			'A tony monky types meaningfull sentense with strang but understanable mistakes',
			30
		);
		const unrelatedScore = scoreAttempt(source, 'vodka glass music runway electrons calendar', 30);

		expect(typoScore.overall).toBeGreaterThan(unrelatedScore.overall);
		expect(typoScore.overall).toBeGreaterThan(60);
		expect(unrelatedScore.overall).toBeLessThan(45);
	});

	it('penalizes answers that are much shorter than the prompt', () => {
		const score = scoreAttempt(source, 'meaningful sentence', 30);

		expect(score.lengthFitness).toBeLessThan(40);
		expect(score.overall).toBeLessThan(70);
	});

	it('does not heavily penalize missing periods when chunk words stay aligned', () => {
		const punctuatedSource =
			'Bright foxes pack lunch before sunrise. Sleepy owls guard the garden after midnight. Careful robots label every crate before shipping.';
		const missingPeriodsAttempt =
			'Bright foxes pack lunch before sunrise sleepy owls guard the garden after midnight careful robots label every crate before shipping';

		const score = scoreAttempt(punctuatedSource, missingPeriodsAttempt, 30);

		expect(score.chunkSimilarity).toBeGreaterThanOrEqual(95);
		expect(score.overall).toBeGreaterThanOrEqual(90);
	});
});

describe('scoreAttemptWithEmbeddings', () => {
	const semanticSource =
		'The quick brown fox jumps over the lazy dog. The clever animal escapes into the forest.';
	const semanticParaphrase =
		'A fast auburn fox leaps past a sleepy canine. The smart creature runs away into the woods.';
	const unrelatedAttempt =
		'Rusty bicycles hum beside a microwave while accountants juggle thunder under elevators.';

	it('exports the documented semantic provider weights', () => {
		expect(SEMANTIC_SCORING_WEIGHTS).toEqual({
			wholeTextSemanticSimilarity: 0.35,
			chunkSemanticSimilarity: 0.3,
			contentWordCoverage: 0.15,
			lexicalWholeTextSimilarity: 0.1,
			lengthFitness: 0.1
		});
	});

	it('returns the deterministic fallback when no embedding provider is supplied', async () => {
		const fallback = scoreAttempt(semanticSource, semanticParaphrase, 30);

		const score = await scoreAttemptWithEmbeddings(semanticSource, semanticParaphrase, 30);

		expect(score.status).toBe('fallback-no-provider');
		expect(score.scoringMode).toBe('fallback');
		expect(score.fallbackScore).toEqual(fallback);
		expect(score.overall).toBe(fallback.overall);
	});

	it('uses mocked whole-text and chunk embeddings for paraphrase-ish scoring', async () => {
		const provider = createConceptProvider();
		const fallback = scoreAttempt(semanticSource, semanticParaphrase, 30);

		const score = await scoreAttemptWithEmbeddings(
			semanticSource,
			semanticParaphrase,
			30,
			provider
		);

		expect(score.status).toBe('semantic');
		expect(score.scoringMode).toBe('semantic');
		expect(score.embedding).toMatchObject({ model: 'mock-concepts', dimensions: 3 });
		expect(score.semanticComponents?.wholeTextSemanticSimilarity).toBeGreaterThan(95);
		expect(score.semanticComponents?.chunkSemanticSimilarity).toBeGreaterThan(95);
		expect(score.overall).toBeGreaterThan(fallback.overall);
		expect(score.overall).toBeGreaterThan(70);
	});

	it('lazily loads and caches embedding providers', async () => {
		let loadCount = 0;
		let embedCount = 0;
		const provider = createLazyEmbeddingProvider(
			async () => {
				loadCount += 1;
				return {
					metadata: {
						model: 'lazy-mock-concepts',
						dimensions: 3,
						normalized: true
					},
					async embed(texts) {
						embedCount += 1;
						return texts.map(conceptVector);
					}
				};
			},
			{ model: 'future-local-worker' }
		);

		expect(provider.metadata).toEqual({ model: 'future-local-worker' });

		const first = await provider.embed(['quick fox']);
		const second = await provider.embed(['smart creature']);

		expect(first).toEqual([[1, 0, 0]]);
		expect(second).toEqual([[0, 1, 0]]);
		expect(loadCount).toBe(1);
		expect(embedCount).toBe(2);
		expect(provider.metadata).toEqual({
			model: 'lazy-mock-concepts',
			dimensions: 3,
			normalized: true
		});
	});

	it('keeps unrelated semantic attempts low with mocked embeddings', async () => {
		const score = await scoreAttemptWithEmbeddings(
			semanticSource,
			unrelatedAttempt,
			30,
			createConceptProvider()
		);

		expect(score.status).toBe('semantic');
		expect(score.overall).toBeLessThan(45);
		expect(score.semanticComponents?.wholeTextSemanticSimilarity).toBeLessThan(10);
		expect(score.semanticComponents?.chunkSemanticSimilarity).toBeLessThan(10);
	});

	it('falls back when an embedding provider throws', async () => {
		const provider: EmbeddingProvider = {
			async embed() {
				throw new Error('model unavailable');
			}
		};

		const score = await scoreAttemptWithEmbeddings(
			semanticSource,
			semanticParaphrase,
			30,
			provider
		);

		expect(score.status).toBe('fallback-provider-error');
		expect(score.scoringMode).toBe('fallback');
		expect(score.error).toContain('model unavailable');
		expect(score.overall).toBe(score.fallbackScore.overall);
	});

	it('falls back when a lazy embedding provider loader fails', async () => {
		let loadCount = 0;
		const provider = createLazyEmbeddingProvider(async () => {
			loadCount += 1;
			throw new Error('worker unsupported');
		});

		const score = await scoreAttemptWithEmbeddings(
			semanticSource,
			semanticParaphrase,
			30,
			provider
		);

		expect(loadCount).toBe(1);
		expect(score.status).toBe('fallback-provider-error');
		expect(score.scoringMode).toBe('fallback');
		expect(score.error).toContain('worker unsupported');
		expect(score.overall).toBe(score.fallbackScore.overall);
	});

	it('falls back when an embedding provider returns malformed vectors', async () => {
		const provider: EmbeddingProvider = {
			async embed(texts) {
				return texts.map((_, index) => (index === 0 ? [1, 0, 0] : [1, 0]));
			}
		};

		const score = await scoreAttemptWithEmbeddings(
			semanticSource,
			semanticParaphrase,
			30,
			provider
		);

		expect(score.status).toBe('fallback-malformed-vectors');
		expect(score.scoringMode).toBe('fallback');
		expect(score.error).toContain('mismatched dimensions');
		expect(score.overall).toBe(score.fallbackScore.overall);
	});
});

function createConceptProvider(): EmbeddingProvider {
	return {
		metadata: {
			model: 'mock-concepts'
		},
		async embed(texts) {
			return texts.map(conceptVector);
		}
	};
}

function conceptVector(text: string): number[] {
	const normalized = text.toLowerCase();
	const firstScene = Number(/fox|dog|canine|quick|fast|auburn|brown|sleepy|lazy/u.test(normalized));
	const secondScene = Number(
		/animal|creature|forest|woods|clever|smart|escapes|away/u.test(normalized)
	);

	if (firstScene || secondScene) return [firstScene, secondScene, 0];
	return [0, 0, 1];
}
