import { averageNearbyChunkSimilarity, buildComparableChunks, type TextChunk } from './chunking';
import {
	computeFallbackScore,
	toScoreBreakdown,
	type RawScoreComponents,
	type ScoreBreakdown
} from './fallback';
import { clamp01, cosineSimilarity, round } from './similarity';
import { FALLBACK_SCORING_WEIGHTS, SEMANTIC_SCORING_WEIGHTS } from './weights';

export type EmbeddingProviderMetadata = {
	model?: string;
	dimensions?: number;
	normalized?: boolean;
};

export type EmbeddingProvider = {
	embed(texts: string[]): Promise<number[][]>;
	metadata?: EmbeddingProviderMetadata;
};

export type SemanticScoreStatus =
	| 'semantic'
	| 'fallback-no-provider'
	| 'fallback-provider-error'
	| 'fallback-malformed-vectors';

export type SemanticScoreBreakdown = ScoreBreakdown & {
	status: SemanticScoreStatus;
	scoringMode: 'semantic' | 'fallback';
	weights: typeof FALLBACK_SCORING_WEIGHTS | typeof SEMANTIC_SCORING_WEIGHTS;
	fallbackScore: ScoreBreakdown;
	semanticComponents?: {
		wholeTextSemanticSimilarity: number;
		chunkSemanticSimilarity: number;
		contentWordCoverage: number;
		lexicalWholeTextSimilarity: number;
		lengthFitness: number;
	};
	embedding?: EmbeddingProviderMetadata & {
		textCount: number;
		dimensions: number;
	};
	error?: string;
};

type EmbeddingTarget = {
	text: string;
	chunkKind?: 'source' | 'attempt';
	chunkIndex?: number;
};

type ValidatedEmbeddings = {
	vectors: number[][];
	dimensions: number;
};

export async function scoreAttemptWithEmbeddings(
	source: string,
	attempt: string,
	elapsedSeconds: number,
	provider?: EmbeddingProvider
): Promise<SemanticScoreBreakdown> {
	const rawFallback = computeFallbackScore(source, attempt, elapsedSeconds);
	const fallbackScore = toScoreBreakdown(rawFallback);

	if (!provider) {
		return fallbackResult(fallbackScore, 'fallback-no-provider');
	}

	const { sourceChunks, attemptChunks } = buildComparableChunks(source, attempt);
	const targets = buildEmbeddingTargets(source, attempt, sourceChunks, attemptChunks);

	let vectors: number[][];
	try {
		vectors = await provider.embed(targets.map((target) => target.text));
	} catch (error) {
		return fallbackResult(fallbackScore, 'fallback-provider-error', errorMessage(error));
	}

	const validation = validateEmbeddingVectors(vectors, targets.length);
	if (!validation.ok) {
		return fallbackResult(fallbackScore, 'fallback-malformed-vectors', validation.error);
	}

	const sourceChunkVectors = Array<number[] | undefined>(sourceChunks.length);
	const attemptChunkVectors = Array<number[] | undefined>(attemptChunks.length);

	targets.forEach((target, index) => {
		if (target.chunkKind === 'source' && target.chunkIndex !== undefined) {
			sourceChunkVectors[target.chunkIndex] = validation.vectors[index];
		}
		if (target.chunkKind === 'attempt' && target.chunkIndex !== undefined) {
			attemptChunkVectors[target.chunkIndex] = validation.vectors[index];
		}
	});

	const wholeTextSemanticSimilarity = clamp01(
		cosineSimilarity(validation.vectors[0], validation.vectors[1])
	);
	const chunkSemanticSimilarity = averageSemanticChunkSimilarity(
		sourceChunks,
		attemptChunks,
		sourceChunkVectors,
		attemptChunkVectors
	);
	const overall = semanticOverall(
		rawFallback,
		wholeTextSemanticSimilarity,
		chunkSemanticSimilarity
	);
	const semanticScore = toScoreBreakdown({
		...rawFallback,
		overall,
		wholeTextSimilarity: wholeTextSemanticSimilarity,
		chunkSimilarity: chunkSemanticSimilarity
	});

	return {
		...semanticScore,
		status: 'semantic',
		scoringMode: 'semantic',
		weights: SEMANTIC_SCORING_WEIGHTS,
		fallbackScore,
		semanticComponents: {
			wholeTextSemanticSimilarity: round(wholeTextSemanticSimilarity * 100),
			chunkSemanticSimilarity: round(chunkSemanticSimilarity * 100),
			contentWordCoverage: round(rawFallback.contentWordCoverage * 100),
			lexicalWholeTextSimilarity: round(rawFallback.wholeTextSimilarity * 100),
			lengthFitness: round(rawFallback.lengthFitness * 100)
		},
		embedding: {
			...provider.metadata,
			textCount: targets.length,
			dimensions: validation.dimensions
		}
	};
}

function fallbackResult(
	fallbackScore: ScoreBreakdown,
	status: Exclude<SemanticScoreStatus, 'semantic'>,
	error?: string
): SemanticScoreBreakdown {
	return {
		...fallbackScore,
		status,
		scoringMode: 'fallback',
		weights: FALLBACK_SCORING_WEIGHTS,
		fallbackScore,
		...(error ? { error } : {})
	};
}

function buildEmbeddingTargets(
	source: string,
	attempt: string,
	sourceChunks: TextChunk[],
	attemptChunks: TextChunk[]
): EmbeddingTarget[] {
	return [
		{ text: source },
		{ text: attempt },
		...sourceChunks.map((chunk, chunkIndex) => ({
			text: chunk.text,
			chunkKind: 'source' as const,
			chunkIndex
		})),
		...attemptChunks.map((chunk, chunkIndex) => ({
			text: chunk.text,
			chunkKind: 'attempt' as const,
			chunkIndex
		}))
	];
}

function validateEmbeddingVectors(
	vectors: unknown,
	expectedCount: number
): ({ ok: true } & ValidatedEmbeddings) | { ok: false; error: string } {
	if (!Array.isArray(vectors)) {
		return { ok: false, error: 'Embedding provider did not return an array.' };
	}

	if (vectors.length !== expectedCount) {
		return {
			ok: false,
			error: `Embedding provider returned ${vectors.length} vectors for ${expectedCount} texts.`
		};
	}

	let dimensions: number | undefined;

	for (const vector of vectors) {
		if (!Array.isArray(vector) || vector.length === 0) {
			return { ok: false, error: 'Embedding provider returned an empty or non-array vector.' };
		}

		dimensions ??= vector.length;
		if (vector.length !== dimensions) {
			return {
				ok: false,
				error: 'Embedding provider returned vectors with mismatched dimensions.'
			};
		}

		if (!vector.every((value) => typeof value === 'number' && Number.isFinite(value))) {
			return { ok: false, error: 'Embedding provider returned non-finite vector values.' };
		}

		const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
		if (magnitude === 0) {
			return { ok: false, error: 'Embedding provider returned a zero-magnitude vector.' };
		}
	}

	return { ok: true, vectors, dimensions: dimensions ?? 0 };
}

function averageSemanticChunkSimilarity(
	sourceChunks: TextChunk[],
	attemptChunks: TextChunk[],
	sourceVectors: Array<number[] | undefined>,
	attemptVectors: Array<number[] | undefined>
): number {
	return averageNearbyChunkSimilarity(sourceChunks, attemptChunks, (sourceChunk, attemptChunk) => {
		const sourceVector = sourceVectors[sourceChunks.indexOf(sourceChunk)];
		const attemptVector = attemptVectors[attemptChunks.indexOf(attemptChunk)];
		if (!sourceVector || !attemptVector) return 0;
		return clamp01(cosineSimilarity(sourceVector, attemptVector));
	});
}

function semanticOverall(
	rawFallback: RawScoreComponents,
	wholeTextSemanticSimilarity: number,
	chunkSemanticSimilarity: number
): number {
	return clamp01(
		wholeTextSemanticSimilarity * SEMANTIC_SCORING_WEIGHTS.wholeTextSemanticSimilarity +
			chunkSemanticSimilarity * SEMANTIC_SCORING_WEIGHTS.chunkSemanticSimilarity +
			rawFallback.contentWordCoverage * SEMANTIC_SCORING_WEIGHTS.contentWordCoverage +
			rawFallback.wholeTextSimilarity * SEMANTIC_SCORING_WEIGHTS.lexicalWholeTextSimilarity +
			rawFallback.lengthFitness * SEMANTIC_SCORING_WEIGHTS.lengthFitness
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Embedding provider failed.';
}
