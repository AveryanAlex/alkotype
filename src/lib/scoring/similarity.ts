export function averageBestTokenSimilarity(expected: string[], actual: string[]): number {
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

export function tokenSimilarity(left: string, right: string): number {
	if (left === right) return 1;
	const sharedPrefix = commonPrefixLength(left, right) / Math.max(left.length, right.length);
	return clamp01(normalizedLevenshtein(left, right) * 0.85 + sharedPrefix * 0.15);
}

export function normalizedLevenshtein(left: string, right: string): number {
	if (left === right) return 1;
	if (left.length === 0 || right.length === 0) return 0;

	const distance = levenshteinDistance(left, right);
	return clamp01(1 - distance / Math.max(left.length, right.length));
}

export function lengthSimilarity(expected: number, actual: number): number {
	if (expected === 0) return actual === 0 ? 1 : 0;
	return clamp01(1 - Math.abs(expected - actual) / expected);
}

export function cosineSimilarity(left: number[], right: number[]): number {
	let dotProduct = 0;
	let leftMagnitude = 0;
	let rightMagnitude = 0;

	for (let index = 0; index < left.length; index += 1) {
		dotProduct += left[index] * right[index];
		leftMagnitude += left[index] * left[index];
		rightMagnitude += right[index] * right[index];
	}

	if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
	return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function round(value: number): number {
	return Math.round(value * 10) / 10;
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

function commonPrefixLength(left: string, right: string): number {
	let index = 0;
	while (index < left.length && index < right.length && left[index] === right[index]) {
		index += 1;
	}
	return index;
}
