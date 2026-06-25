import { describe, expect, it } from 'vitest';
import {
	addRunHistoryEntry,
	createRunHistoryEntry,
	loadRunHistory,
	parseRunHistory,
	saveRunHistory,
	serializeRunHistory,
	summarizeRunHistoryEntry,
	type RunHistoryEntry,
	type RunHistoryStorage
} from './history';
import {
	applySessionInput,
	calculateSessionResult,
	createGameSession,
	finishSession
} from './session';

describe('run history helpers', () => {
	it('creates a shareable entry from a finished result', () => {
		const session = finishSession(
			applySessionInput(createGameSession(), 'The team wanted a typing game', 1_000),
			11_000
		);
		const result = calculateSessionResult(session, 50_000);

		const entry = createRunHistoryEntry(result, 11_000);

		expect(entry).toMatchObject({
			id: '11000-classic-classic-product-meeting',
			modeId: 'classic',
			modeLabel: 'Classic',
			promptId: 'classic-product-meeting',
			promptTitle: 'Morning Product Meeting',
			finishedAtMs: 11_000,
			rawWpm: result.score.wpm,
			similarity: result.score.overall,
			effectiveWpm: result.score.effectiveWpm,
			elapsedSeconds: 10,
			scoringElapsedSeconds: 10,
			components: {
				wholeTextSimilarity: result.score.wholeTextSimilarity,
				contentWordCoverage: result.score.contentWordCoverage,
				chunkSimilarity: result.score.chunkSimilarity,
				lengthFitness: result.score.lengthFitness
			}
		});

		expect(summarizeRunHistoryEntry(entry)).toContain('Alkotype result:');
		expect(summarizeRunHistoryEntry(entry)).toContain('effective WPM');
		expect(summarizeRunHistoryEntry(entry)).toContain('whole text');
	});

	it('loads and saves bounded entries newest first', () => {
		const storage = createMemoryStorage();
		const oldEntry = createEntry({ id: 'old', finishedAtMs: 1_000 });
		const newerEntry = createEntry({ id: 'newer', finishedAtMs: 3_000 });
		const newestEntry = createEntry({ id: 'newest', finishedAtMs: 5_000 });

		const saved = saveRunHistory(storage, [oldEntry, newestEntry, newerEntry], 'history', 2);

		expect(saved.map((entry) => entry.id)).toEqual(['newest', 'newer']);
		expect(loadRunHistory(storage, 'history').map((entry) => entry.id)).toEqual([
			'newest',
			'newer'
		]);
	});

	it('adds a new result while replacing duplicate ids', () => {
		const original = createEntry({ id: 'same', finishedAtMs: 1_000, similarity: 30 });
		const replacement = createEntry({ id: 'same', finishedAtMs: 2_000, similarity: 80 });
		const older = createEntry({ id: 'older', finishedAtMs: 500 });

		const entries = addRunHistoryEntry([original, older], replacement, 4);

		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({ id: 'same', similarity: 80 });
		expect(entries[1]).toMatchObject({ id: 'older' });
	});

	it('falls back to empty history for malformed localStorage data', () => {
		const storage = createMemoryStorage({ history: '{not valid json' });

		expect(loadRunHistory(storage, 'history')).toEqual([]);
		expect(parseRunHistory(JSON.stringify({ entries: [] }))).toEqual([]);
		expect(parseRunHistory(JSON.stringify([createEntry(), { id: '' }]))).toEqual([createEntry()]);
	});

	it('serializes only valid bounded entries', () => {
		const entries = [
			createEntry({ id: 'first', finishedAtMs: 1_000 }),
			createEntry({ id: 'second', finishedAtMs: 2_000 })
		];

		expect(parseRunHistory(serializeRunHistory(entries, 1))).toEqual([
			createEntry({ id: 'second', finishedAtMs: 2_000 })
		]);
	});
});

function createMemoryStorage(initial: Record<string, string> = {}): RunHistoryStorage {
	const values = new Map(Object.entries(initial));

	return {
		getItem(key) {
			return values.get(key) ?? null;
		},
		setItem(key, value) {
			values.set(key, value);
		}
	};
}

function createEntry(overrides: Partial<RunHistoryEntry> = {}): RunHistoryEntry {
	return {
		id: 'entry',
		modeId: 'classic',
		modeLabel: 'Classic',
		promptId: 'classic-product-meeting',
		promptTitle: 'Morning Product Meeting',
		finishedAtMs: 1_000,
		rawWpm: 42,
		similarity: 76,
		effectiveWpm: 32,
		elapsedSeconds: 12.3,
		scoringElapsedSeconds: 12.3,
		components: {
			wholeTextSimilarity: 70,
			contentWordCoverage: 80,
			chunkSimilarity: 75,
			lengthFitness: 90
		},
		...overrides
	};
}
