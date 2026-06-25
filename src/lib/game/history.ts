import type { ScoreBreakdown } from '../scoring';
import type { GameSessionResult } from './session';

export const RUN_HISTORY_STORAGE_KEY = 'alkotype.runHistory.v1';
export const RUN_HISTORY_LIMIT = 8;

export type RunHistoryScoreComponents = Pick<
	ScoreBreakdown,
	'wholeTextSimilarity' | 'contentWordCoverage' | 'chunkSimilarity' | 'lengthFitness'
>;

export type RunHistoryEntry = {
	readonly id: string;
	readonly modeId: string;
	readonly modeLabel: string;
	readonly promptId: string;
	readonly promptTitle: string;
	readonly finishedAtMs: number;
	readonly rawWpm: number;
	readonly similarity: number;
	readonly effectiveWpm: number;
	readonly elapsedSeconds: number;
	readonly scoringElapsedSeconds: number;
	readonly components: RunHistoryScoreComponents;
};

export type RunHistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createRunHistoryEntry(
	result: GameSessionResult,
	finishedAtMs: number
): RunHistoryEntry {
	return {
		id: `${finishedAtMs}-${result.mode.id}-${result.prompt.id}`,
		modeId: result.mode.id,
		modeLabel: result.mode.label,
		promptId: result.prompt.id,
		promptTitle: result.prompt.title,
		finishedAtMs,
		rawWpm: result.score.wpm,
		similarity: result.score.overall,
		effectiveWpm: result.score.effectiveWpm,
		elapsedSeconds: result.elapsedSeconds,
		scoringElapsedSeconds: result.scoringElapsedSeconds,
		components: {
			wholeTextSimilarity: result.score.wholeTextSimilarity,
			contentWordCoverage: result.score.contentWordCoverage,
			chunkSimilarity: result.score.chunkSimilarity,
			lengthFitness: result.score.lengthFitness
		}
	};
}

export function addRunHistoryEntry(
	entries: readonly RunHistoryEntry[],
	entry: RunHistoryEntry,
	limit = RUN_HISTORY_LIMIT
): RunHistoryEntry[] {
	return boundRunHistory(
		[entry, ...entries.filter((candidate) => candidate.id !== entry.id)],
		limit
	);
}

export function boundRunHistory(
	entries: readonly RunHistoryEntry[],
	limit = RUN_HISTORY_LIMIT
): RunHistoryEntry[] {
	return [...entries]
		.sort((left, right) => right.finishedAtMs - left.finishedAtMs)
		.slice(0, Math.max(0, limit));
}

export function parseRunHistory(serialized: string | null): RunHistoryEntry[] {
	if (!serialized) return [];

	try {
		const parsed: unknown = JSON.parse(serialized);
		if (!Array.isArray(parsed)) return [];

		return boundRunHistory(parsed.map(parseRunHistoryEntry).filter(isRunHistoryEntry));
	} catch {
		return [];
	}
}

export function serializeRunHistory(
	entries: readonly RunHistoryEntry[],
	limit = RUN_HISTORY_LIMIT
): string {
	return JSON.stringify(boundRunHistory(entries, limit));
}

export function loadRunHistory(
	storage: RunHistoryStorage,
	key = RUN_HISTORY_STORAGE_KEY
): RunHistoryEntry[] {
	try {
		return parseRunHistory(storage.getItem(key));
	} catch {
		return [];
	}
}

export function saveRunHistory(
	storage: RunHistoryStorage,
	entries: readonly RunHistoryEntry[],
	key = RUN_HISTORY_STORAGE_KEY,
	limit = RUN_HISTORY_LIMIT
): RunHistoryEntry[] {
	const bounded = boundRunHistory(entries, limit);
	storage.setItem(key, serializeRunHistory(bounded, limit));
	return bounded;
}

export function summarizeRunHistoryEntry(entry: RunHistoryEntry): string {
	return `Alkotype result: ${entry.effectiveWpm} effective WPM after ${formatSeconds(entry.elapsedSeconds)}s. ${entry.similarity}% similar, ${entry.rawWpm} raw WPM, ${entry.modeLabel} / ${entry.promptTitle}. Breakdown: whole text ${entry.components.wholeTextSimilarity}%, content words ${entry.components.contentWordCoverage}%, chunks ${entry.components.chunkSimilarity}%, length fit ${entry.components.lengthFitness}%. The keyboard had a drink; the score mostly stayed upright.`;
}

function parseRunHistoryEntry(value: unknown): RunHistoryEntry | null {
	if (!isRecord(value) || !isRecord(value.components)) return null;

	const entry = {
		id: value.id,
		modeId: value.modeId,
		modeLabel: value.modeLabel,
		promptId: value.promptId,
		promptTitle: value.promptTitle,
		finishedAtMs: value.finishedAtMs,
		rawWpm: value.rawWpm,
		similarity: value.similarity,
		effectiveWpm: value.effectiveWpm,
		elapsedSeconds: value.elapsedSeconds,
		scoringElapsedSeconds: value.scoringElapsedSeconds,
		components: {
			wholeTextSimilarity: value.components.wholeTextSimilarity,
			contentWordCoverage: value.components.contentWordCoverage,
			chunkSimilarity: value.components.chunkSimilarity,
			lengthFitness: value.components.lengthFitness
		}
	};

	return isRunHistoryEntry(entry) ? entry : null;
}

function isRunHistoryEntry(value: unknown): value is RunHistoryEntry {
	if (!isRecord(value) || !isRecord(value.components)) return false;

	return (
		isNonEmptyString(value.id) &&
		isNonEmptyString(value.modeId) &&
		isNonEmptyString(value.modeLabel) &&
		isNonEmptyString(value.promptId) &&
		isNonEmptyString(value.promptTitle) &&
		isNonNegativeFiniteNumber(value.finishedAtMs) &&
		isNonNegativeFiniteNumber(value.rawWpm) &&
		isPercent(value.similarity) &&
		isNonNegativeFiniteNumber(value.effectiveWpm) &&
		isNonNegativeFiniteNumber(value.elapsedSeconds) &&
		isNonNegativeFiniteNumber(value.scoringElapsedSeconds) &&
		isPercent(value.components.wholeTextSimilarity) &&
		isPercent(value.components.contentWordCoverage) &&
		isPercent(value.components.chunkSimilarity) &&
		isPercent(value.components.lengthFitness)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPercent(value: unknown): value is number {
	return isNonNegativeFiniteNumber(value) && value <= 100;
}

function formatSeconds(seconds: number): string {
	return seconds.toFixed(1);
}
