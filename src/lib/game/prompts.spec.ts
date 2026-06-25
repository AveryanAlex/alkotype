import { describe, expect, it } from 'vitest';
import {
	GAME_MODE_IDS,
	GAME_MODES,
	PROMPTS,
	getDefaultPrompt,
	getGameMode,
	getPrompt,
	getPromptsForMode
} from './prompts';

describe('game prompt catalog', () => {
	it('defines the required static modes in a stable order', () => {
		expect(GAME_MODE_IDS).toEqual(['classic', 'alco', 'benchmark']);
		expect(GAME_MODES.map((mode) => mode.id)).toEqual(GAME_MODE_IDS);
	});

	it('keeps mode ids and prompt ids unique', () => {
		const modeIds = GAME_MODES.map((mode) => mode.id);
		const promptIds = PROMPTS.map((prompt) => prompt.id);

		expect(new Set(modeIds).size).toBe(modeIds.length);
		expect(new Set(promptIds).size).toBe(promptIds.length);
	});

	it('keeps prompt data local to the typed catalog', () => {
		expect(PROMPTS.length).toBeGreaterThanOrEqual(6);
		expect(
			PROMPTS.every(
				(prompt) =>
					prompt.id.length > 0 &&
					prompt.title.length > 0 &&
					prompt.description.length > 0 &&
					prompt.text.split(/\s+/u).length >= 12 &&
					prompt.tags.length > 0
			)
		).toBe(true);
	});

	it('attaches mode-specific tone, settings, help text, and matching prompts', () => {
		for (const mode of GAME_MODES) {
			expect(mode.label.length).toBeGreaterThan(0);
			expect(mode.description.length).toBeGreaterThan(0);
			expect(mode.helpText.length).toBeGreaterThan(0);
			expect(mode.tone.placeholder.length).toBeGreaterThan(0);
			expect(mode.settings.scoring).toBe('deterministic-fallback');
			expect(mode.settings.timerStartsOn).toBe('first-input');
			expect(mode.prompts.length).toBeGreaterThanOrEqual(2);
			expect(mode.prompts.every((prompt) => prompt.modeId === mode.id)).toBe(true);
		}
	});

	it('marks benchmark prompts as a fixed stable set', () => {
		const benchmark = getGameMode('benchmark');

		expect(benchmark.settings).toMatchObject({
			benchmarkStable: true,
			promptRotation: 'fixed-sequence',
			punctuation: 'fixed'
		});
		expect(benchmark.prompts.map((prompt) => prompt.id)).toEqual([
			'benchmark-product-promise',
			'benchmark-static-scoring',
			'benchmark-no-backend'
		]);
		expect(benchmark.prompts.every((prompt) => prompt.stableForBenchmark === true)).toBe(true);
	});

	it('resolves defaults and prompts by mode', () => {
		const classicDefault = getDefaultPrompt('classic');
		const alcoPrompts = getPromptsForMode('alco');

		expect(classicDefault.id).toBe('classic-product-meeting');
		expect(getPrompt('classic', classicDefault.id)).toEqual(classicDefault);
		expect(alcoPrompts.map((prompt) => prompt.modeId)).toEqual(['alco', 'alco', 'alco']);
	});
});
