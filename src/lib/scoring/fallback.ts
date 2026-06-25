import { averageNearbyChunkSimilarity, buildComparableChunks } from './chunking';
import { contentWords, normalizeText, tokenize } from './normalization';
import {
	averageBestTokenSimilarity,
	clamp01,
	lengthSimilarity,
	normalizedLevenshtein,
	round
} from './similarity';
import { FALLBACK_SCORING_WEIGHTS } from './weights';

export type ScoreBreakdown = {
	overall: number;
	wpm: number;
	effectiveWpm: number;
	wholeTextSimilarity: number;
	contentWordCoverage: number;
	chunkSimilarity: number;
	lengthFitness: number;
};

export type RawScoreComponents = {
	overall: number;
	wpm: number;
	wholeTextSimilarity: number;
	contentWordCoverage: number;
	chunkSimilarity: number;
	lengthFitness: number;
};

export function scoreAttempt(
	source: string,
	attempt: string,
	elapsedSeconds: number
): ScoreBreakdown {
	return toScoreBreakdown(computeFallbackScore(source, attempt, elapsedSeconds));
}

export function computeFallbackScore(
	source: string,
	attempt: string,
	elapsedSeconds: number
): RawScoreComponents {
	const sourceWords = tokenize(source);
	const attemptWords = tokenize(attempt);
	const sourceContent = contentWords(source);
	const attemptContent = contentWords(attempt);
	const { sourceChunks, attemptChunks } = buildComparableChunks(source, attempt);

	const wholeTextSimilarity = normalizedLevenshtein(normalizeText(source), normalizeText(attempt));
	const contentWordCoverage = averageBestTokenSimilarity(sourceContent, attemptContent);
	const chunkSimilarity = averageNearbyChunkSimilarity(
		sourceChunks,
		attemptChunks,
		(sourceChunk, attemptChunk) => averageBestTokenSimilarity(sourceChunk.words, attemptChunk.words)
	);
	const lengthFitness = lengthSimilarity(sourceWords.length, attemptWords.length);

	const overall = clamp01(
		wholeTextSimilarity * FALLBACK_SCORING_WEIGHTS.wholeTextSimilarity +
			contentWordCoverage * FALLBACK_SCORING_WEIGHTS.contentWordCoverage +
			chunkSimilarity * FALLBACK_SCORING_WEIGHTS.chunkSimilarity +
			lengthFitness * FALLBACK_SCORING_WEIGHTS.lengthFitness
	);

	return {
		overall,
		wpm: calculateWpmForWordCount(attemptWords.length, elapsedSeconds),
		wholeTextSimilarity,
		contentWordCoverage,
		chunkSimilarity,
		lengthFitness
	};
}

export function toScoreBreakdown(raw: RawScoreComponents): ScoreBreakdown {
	return {
		overall: round(raw.overall * 100),
		wpm: round(raw.wpm),
		effectiveWpm: round(raw.wpm * raw.overall),
		wholeTextSimilarity: round(raw.wholeTextSimilarity * 100),
		contentWordCoverage: round(raw.contentWordCoverage * 100),
		chunkSimilarity: round(raw.chunkSimilarity * 100),
		lengthFitness: round(raw.lengthFitness * 100)
	};
}

export function calculateWpmForWordCount(wordCount: number, elapsedSeconds: number): number {
	const minutes = Math.max(elapsedSeconds, 1) / 60;
	return wordCount / minutes;
}
