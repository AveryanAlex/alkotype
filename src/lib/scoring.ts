const STOP_WORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'by',
	'for',
	'from',
	'has',
	'in',
	'is',
	'it',
	'its',
	'of',
	'on',
	'or',
	'that',
	'the',
	'to',
	'was',
	'with',
	'и',
	'в',
	'во',
	'на',
	'не',
	'но',
	'что',
	'это',
	'как',
	'по',
	'от',
	'из',
	'за'
]);

export type ScoreBreakdown = {
	overall: number;
	wpm: number;
	effectiveWpm: number;
	wholeTextSimilarity: number;
	contentWordCoverage: number;
	chunkSimilarity: number;
	lengthFitness: number;
};

export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function tokenize(text: string): string[] {
	const normalized = normalizeText(text);
	return normalized ? normalized.split(' ') : [];
}

export function contentWords(text: string): string[] {
	return tokenize(text).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

export function scoreAttempt(
	source: string,
	attempt: string,
	elapsedSeconds: number
): ScoreBreakdown {
	const sourceWords = tokenize(source);
	const attemptWords = tokenize(attempt);
	const sourceContent = contentWords(source);
	const attemptContent = contentWords(attempt);

	const wholeTextSimilarity = normalizedLevenshtein(normalizeText(source), normalizeText(attempt));
	const contentWordCoverage = averageBestTokenSimilarity(sourceContent, attemptContent);
	const chunkSimilarity = averageChunkSimilarity(sourceWords, attemptWords, 10);
	const lengthFitness = lengthSimilarity(sourceWords.length, attemptWords.length);

	const overall = clamp01(
		wholeTextSimilarity * 0.25 +
			contentWordCoverage * 0.35 +
			chunkSimilarity * 0.25 +
			lengthFitness * 0.15
	);

	const minutes = Math.max(elapsedSeconds, 1) / 60;
	const wpm = attemptWords.length / minutes;

	return {
		overall: round(overall * 100),
		wpm: round(wpm),
		effectiveWpm: round(wpm * overall),
		wholeTextSimilarity: round(wholeTextSimilarity * 100),
		contentWordCoverage: round(contentWordCoverage * 100),
		chunkSimilarity: round(chunkSimilarity * 100),
		lengthFitness: round(lengthFitness * 100)
	};
}

function averageBestTokenSimilarity(expected: string[], actual: string[]): number {
	if (expected.length === 0) return actual.length === 0 ? 1 : 0;
	if (actual.length === 0) return 0;

	const total = expected.reduce((sum, word) => {
		const best = actual.reduce(
			(max, candidate) => Math.max(max, tokenSimilarity(word, candidate)),
			0
		);
		return sum + best;
	}, 0);

	return total / expected.length;
}

function averageChunkSimilarity(
	expectedWords: string[],
	actualWords: string[],
	chunkSize: number
): number {
	const expectedChunks = chunkWords(expectedWords, chunkSize);
	const actualChunks = chunkWords(actualWords, chunkSize);

	if (expectedChunks.length === 0) return actualChunks.length === 0 ? 1 : 0;
	if (actualChunks.length === 0) return 0;

	const total = expectedChunks.reduce((sum, expected, index) => {
		const actual = actualChunks[index] ?? [];
		return sum + averageBestTokenSimilarity(expected, actual);
	}, 0);

	return total / expectedChunks.length;
}

function chunkWords(words: string[], chunkSize: number): string[][] {
	const chunks: string[][] = [];
	for (let index = 0; index < words.length; index += chunkSize) {
		chunks.push(words.slice(index, index + chunkSize));
	}
	return chunks;
}

function tokenSimilarity(left: string, right: string): number {
	if (left === right) return 1;
	const sharedPrefix = commonPrefixLength(left, right) / Math.max(left.length, right.length);
	return clamp01(normalizedLevenshtein(left, right) * 0.85 + sharedPrefix * 0.15);
}

function normalizedLevenshtein(left: string, right: string): number {
	if (left === right) return 1;
	if (left.length === 0 || right.length === 0) return 0;

	const distance = levenshteinDistance(left, right);
	return clamp01(1 - distance / Math.max(left.length, right.length));
}

function levenshteinDistance(left: string, right: string): number {
	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	const current = Array.from({ length: right.length + 1 }, () => 0);

	for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
		current[0] = leftIndex;

		for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
			const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			current[rightIndex] = Math.min(
				previous[rightIndex] + 1,
				current[rightIndex - 1] + 1,
				previous[rightIndex - 1] + substitutionCost
			);
		}

		for (let index = 0; index <= right.length; index += 1) {
			previous[index] = current[index];
		}
	}

	return previous[right.length];
}

function lengthSimilarity(expected: number, actual: number): number {
	if (expected === 0) return actual === 0 ? 1 : 0;
	return clamp01(1 - Math.abs(expected - actual) / expected);
}

function commonPrefixLength(left: string, right: string): number {
	let index = 0;
	while (index < left.length && index < right.length && left[index] === right[index]) {
		index += 1;
	}
	return index;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
