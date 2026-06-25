import { tokenize } from './normalization';

const SENTENCE_BOUNDARY = /[.!?]+|\n+/u;
const TARGET_CHUNK_WORDS = 10;

export type TextChunk = {
	text: string;
	words: string[];
};

export type ComparableChunks = {
	sourceChunks: TextChunk[];
	attemptChunks: TextChunk[];
};

export function buildComparableChunks(source: string, attempt: string): ComparableChunks {
	const sourceChunks = segmentSource(source);
	const attemptChunks = segmentAttemptForSource(source, attempt, sourceChunks);

	return { sourceChunks, attemptChunks };
}

export function segmentSource(text: string): TextChunk[] {
	if (hasSentenceBoundary(text)) {
		const sentenceChunks = splitOnSentenceBoundaries(text);
		if (sentenceChunks.length > 0) return sentenceChunks;
	}

	return chunkWordsByTarget(tokenize(text));
}

export function segmentAttemptForSource(
	source: string,
	attempt: string,
	sourceChunks = segmentSource(source)
): TextChunk[] {
	const attemptSentenceChunks = hasSentenceBoundary(attempt)
		? splitOnSentenceBoundaries(attempt)
		: [];

	if (hasSentenceBoundary(source) && attemptSentenceChunks.length === sourceChunks.length) {
		return attemptSentenceChunks;
	}

	if (!hasSentenceBoundary(source)) {
		return chunkWordsByTarget(tokenize(attempt));
	}

	return chunkWordsBySourceShape(tokenize(attempt), sourceChunks);
}

export function averageNearbyChunkSimilarity(
	sourceChunks: TextChunk[],
	attemptChunks: TextChunk[],
	compare: (sourceChunk: TextChunk, attemptChunk: TextChunk) => number
): number {
	if (sourceChunks.length === 0) return attemptChunks.length === 0 ? 1 : 0;
	if (attemptChunks.length === 0) return 0;

	const total = sourceChunks.reduce((sum, sourceChunk, index) => {
		let best = 0;

		for (const candidateIndex of [index - 1, index, index + 1]) {
			const attemptChunk = attemptChunks[candidateIndex];
			if (!attemptChunk) continue;
			best = Math.max(best, compare(sourceChunk, attemptChunk));
		}

		return sum + best;
	}, 0);

	return total / sourceChunks.length;
}

function hasSentenceBoundary(text: string): boolean {
	return SENTENCE_BOUNDARY.test(text);
}

function splitOnSentenceBoundaries(text: string): TextChunk[] {
	return text
		.split(SENTENCE_BOUNDARY)
		.map((part) => part.trim())
		.map((part) => toChunk(part))
		.filter((chunk): chunk is TextChunk => chunk.words.length > 0);
}

function chunkWordsByTarget(words: string[]): TextChunk[] {
	if (words.length === 0) return [];
	if (words.length <= TARGET_CHUNK_WORDS + 2) return [toChunk(words.join(' '))];

	const chunkCount = Math.max(1, Math.round(words.length / TARGET_CHUNK_WORDS));
	const chunks: TextChunk[] = [];
	let start = 0;

	for (let index = 0; index < chunkCount; index += 1) {
		const remainingWords = words.length - start;
		const remainingChunks = chunkCount - index;
		const chunkSize = Math.ceil(remainingWords / remainingChunks);
		chunks.push(toChunk(words.slice(start, start + chunkSize).join(' ')));
		start += chunkSize;
	}

	return chunks;
}

function chunkWordsBySourceShape(words: string[], sourceChunks: TextChunk[]): TextChunk[] {
	if (sourceChunks.length === 0) return chunkWordsByTarget(words);

	const sourceWordCount = sourceChunks.reduce((total, chunk) => total + chunk.words.length, 0);
	if (sourceWordCount === 0) return chunkWordsByTarget(words);

	const chunks: TextChunk[] = [];
	let sourceWordsSeen = 0;
	let start = 0;

	for (let index = 0; index < sourceChunks.length; index += 1) {
		sourceWordsSeen += sourceChunks[index].words.length;
		const isLastChunk = index === sourceChunks.length - 1;
		const end = isLastChunk
			? words.length
			: Math.round((sourceWordsSeen / sourceWordCount) * words.length);
		chunks.push(toChunk(words.slice(start, Math.max(start, end)).join(' ')));
		start = Math.max(start, end);
	}

	return chunks;
}

function toChunk(text: string): TextChunk {
	const words = tokenize(text);
	return {
		text: words.join(' '),
		words
	};
}
