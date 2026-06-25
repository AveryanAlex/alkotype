export const FALLBACK_SCORING_WEIGHTS = Object.freeze({
	wholeTextSimilarity: 0.25,
	contentWordCoverage: 0.35,
	chunkSimilarity: 0.25,
	lengthFitness: 0.15
});

export const SEMANTIC_SCORING_WEIGHTS = Object.freeze({
	wholeTextSemanticSimilarity: 0.35,
	chunkSemanticSimilarity: 0.3,
	contentWordCoverage: 0.15,
	lexicalWholeTextSimilarity: 0.1,
	lengthFitness: 0.1
});
