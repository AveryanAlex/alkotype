import { describe, expect, it } from 'vitest';
import { scoreAttempt } from '../scoring';
import { getDefaultPrompt, getPromptsForMode } from './prompts';
import {
	applySessionInput,
	calculateSessionResult,
	createGameSession,
	finishSession,
	getElapsedSeconds,
	getSessionControlState,
	getSessionPhase,
	isTypingDisabled,
	resetSession,
	selectNextSessionPrompt,
	selectSessionMode,
	selectSessionPrompt
} from './session';

describe('game session helpers', () => {
	it('creates an idle default session with keyboard-friendly controls', () => {
		const session = createGameSession();

		expect(session).toEqual({
			modeId: 'classic',
			promptId: 'classic-product-meeting',
			attempt: '',
			startedAtMs: null,
			finishedAtMs: null
		});
		expect(getSessionPhase(session)).toBe('idle');
		expect(getElapsedSeconds(session, 12_345)).toBe(0);
		expect(getSessionControlState(session)).toEqual({
			typingDisabled: false,
			finishDisabled: false,
			resetDisabled: true,
			modeSelectionDisabled: false,
			promptSelectionDisabled: false
		});
	});

	it('selects mode and prompt as reset sessions', () => {
		const active = applySessionInput(createGameSession(), 'recognizable attempt', 1_000);
		const alco = selectSessionMode(active, 'alco');
		const defaultAlcoPrompt = getDefaultPrompt('alco');
		const alcoPrompts = getPromptsForMode('alco');
		const secondAlcoPrompt = alcoPrompts[1];

		expect(alco).toEqual({
			modeId: 'alco',
			promptId: defaultAlcoPrompt.id,
			attempt: '',
			startedAtMs: null,
			finishedAtMs: null
		});
		expect(secondAlcoPrompt).toBeDefined();
		if (!secondAlcoPrompt) throw new Error('Expected a second Alco prompt');

		expect(selectSessionPrompt(alco, secondAlcoPrompt.id)).toEqual({
			modeId: 'alco',
			promptId: secondAlcoPrompt.id,
			attempt: '',
			startedAtMs: null,
			finishedAtMs: null
		});
	});

	it('starts on input and freezes elapsed time after finish', () => {
		const running = applySessionInput(createGameSession(), 'The team wanted a typing game', 10_000);
		const finished = finishSession(running, 15_500);
		const ignoredInput = applySessionInput(finished, 'ignored after finish', 20_000);

		expect(running.startedAtMs).toBe(10_000);
		expect(running.finishedAtMs).toBeNull();
		expect(getElapsedSeconds(running, 13_000)).toBe(3);
		expect(getSessionPhase(running)).toBe('running');
		expect(getSessionControlState(running)).toMatchObject({
			typingDisabled: false,
			finishDisabled: false,
			modeSelectionDisabled: true,
			promptSelectionDisabled: true
		});
		expect(finished.finishedAtMs).toBe(15_500);
		expect(getElapsedSeconds(finished, 99_000)).toBe(5.5);
		expect(getSessionPhase(finished)).toBe('finished');
		expect(isTypingDisabled(finished)).toBe(true);
		expect(getSessionControlState(finished)).toMatchObject({
			typingDisabled: true,
			finishDisabled: true,
			modeSelectionDisabled: false,
			promptSelectionDisabled: false
		});
		expect(ignoredInput).toBe(finished);
	});

	it('calculates a scored result with the deterministic breakdown', () => {
		const prompt = getDefaultPrompt('classic');
		const attempt =
			'The team wanted a typing game where mistakes are allowed and speed matters while the idea stays recognizable';
		const session = finishSession(applySessionInput(createGameSession(), attempt, 0), 30_000);
		const result = calculateSessionResult(session, 99_000);

		expect(result).toMatchObject({
			mode: { id: 'classic' },
			prompt,
			phase: 'finished',
			attempt,
			elapsedSeconds: 30,
			scoringElapsedSeconds: 30
		});
		expect(result.score).toEqual(scoreAttempt(prompt.text, attempt, 30));
		expect(result.score).toMatchObject({
			overall: expect.any(Number),
			wpm: expect.any(Number),
			effectiveWpm: expect.any(Number),
			wholeTextSimilarity: expect.any(Number),
			contentWordCoverage: expect.any(Number),
			chunkSimilarity: expect.any(Number),
			lengthFitness: expect.any(Number)
		});
		expect(result.score.overall).toBeGreaterThan(0);
	});

	it('resets the active prompt and can advance to a new prompt', () => {
		const session = finishSession(
			applySessionInput(createGameSession(), 'rough attempt', 1_000),
			2_500
		);
		const reset = resetSession(session);
		const next = selectNextSessionPrompt(reset);
		const classicPrompts = getPromptsForMode('classic');
		const expectedNextPrompt = classicPrompts[1];

		expect(reset).toEqual({
			...session,
			attempt: '',
			startedAtMs: null,
			finishedAtMs: null
		});
		expect(expectedNextPrompt).toBeDefined();
		if (!expectedNextPrompt) throw new Error('Expected a second Classic prompt');

		expect(next).toEqual({
			modeId: 'classic',
			promptId: expectedNextPrompt.id,
			attempt: '',
			startedAtMs: null,
			finishedAtMs: null
		});
	});

	it('finishes an idle session without invalid scoring time', () => {
		const finished = finishSession(createGameSession(), 42_000);
		const result = calculateSessionResult(finished, 45_000);

		expect(finished.startedAtMs).toBe(42_000);
		expect(finished.finishedAtMs).toBe(42_000);
		expect(result.elapsedSeconds).toBe(0);
		expect(result.scoringElapsedSeconds).toBe(1);
		expect(result.score).toEqual(scoreAttempt(getDefaultPrompt('classic').text, '', 1));
	});
});
