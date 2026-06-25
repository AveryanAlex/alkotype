import { describe, expect, it } from 'vitest';
import { contentWords, scoreAttempt, tokenize } from './scoring';

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

	it('gives an exact attempt a perfect similarity score', () => {
		const score = scoreAttempt(source, source, 30);

		expect(score.overall).toBe(100);
		expect(score.effectiveWpm).toBe(score.wpm);
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
	});

	it('penalizes answers that are much shorter than the prompt', () => {
		const score = scoreAttempt(source, 'meaningful sentence', 30);

		expect(score.lengthFitness).toBeLessThan(40);
		expect(score.overall).toBeLessThan(70);
	});
});
