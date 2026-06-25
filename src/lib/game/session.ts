import { scoreAttempt, type ScoreBreakdown } from '../scoring';
import {
	DEFAULT_GAME_MODE_ID,
	getDefaultPrompt,
	getGameMode,
	getPrompt,
	getPromptsForMode,
	type GameMode,
	type GameModeId,
	type GamePrompt,
	type PromptId
} from './prompts';

export const MIN_SCORING_SECONDS = 1;

export type GameSessionPhase = 'idle' | 'running' | 'finished';

export type GameSession = {
	readonly modeId: GameModeId;
	readonly promptId: PromptId;
	readonly attempt: string;
	readonly startedAtMs: number | null;
	readonly finishedAtMs: number | null;
};

export type CreateGameSessionOptions = {
	readonly modeId?: GameModeId;
	readonly promptId?: PromptId;
	readonly attempt?: string;
	readonly startedAtMs?: number | null;
	readonly finishedAtMs?: number | null;
};

export type SessionControlState = {
	readonly typingDisabled: boolean;
	readonly finishDisabled: boolean;
	readonly resetDisabled: boolean;
	readonly modeSelectionDisabled: boolean;
	readonly promptSelectionDisabled: boolean;
};

export type GameSessionResult = {
	readonly mode: GameMode;
	readonly prompt: GamePrompt;
	readonly phase: GameSessionPhase;
	readonly attempt: string;
	readonly elapsedSeconds: number;
	readonly scoringElapsedSeconds: number;
	readonly score: ScoreBreakdown;
};

export function createGameSession(options: CreateGameSessionOptions = {}): GameSession {
	const modeId = options.modeId ?? DEFAULT_GAME_MODE_ID;
	const prompt =
		options.promptId === undefined ? getDefaultPrompt(modeId) : getPrompt(modeId, options.promptId);
	const requestedStartedAtMs = options.startedAtMs ?? null;
	const requestedFinishedAtMs = options.finishedAtMs ?? null;
	const startedAtMs =
		requestedFinishedAtMs !== null && requestedStartedAtMs === null
			? requestedFinishedAtMs
			: requestedStartedAtMs;
	const finishedAtMs =
		requestedFinishedAtMs !== null && startedAtMs !== null
			? Math.max(requestedFinishedAtMs, startedAtMs)
			: requestedFinishedAtMs;

	return {
		modeId,
		promptId: prompt.id,
		attempt: options.attempt ?? '',
		startedAtMs,
		finishedAtMs
	};
}

export function selectSessionMode(session: GameSession, modeId: GameModeId): GameSession {
	if (session.modeId === modeId) return resetSession(session);
	return createGameSession({ modeId });
}

export function selectSessionPrompt(session: GameSession, promptId: PromptId): GameSession {
	const prompt = getPrompt(session.modeId, promptId);
	return createGameSession({ modeId: prompt.modeId, promptId: prompt.id });
}

export function selectNextSessionPrompt(session: GameSession): GameSession {
	const prompts = getPromptsForMode(session.modeId);
	const currentIndex = prompts.findIndex((prompt) => prompt.id === session.promptId);
	const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % prompts.length;
	const nextPrompt = prompts[nextIndex];

	if (!nextPrompt) throw new Error(`Game mode has no prompts: ${session.modeId}`);
	return createGameSession({ modeId: session.modeId, promptId: nextPrompt.id });
}

export function resetSession(session: GameSession): GameSession {
	return {
		...session,
		attempt: '',
		startedAtMs: null,
		finishedAtMs: null
	};
}

export function startSession(session: GameSession, startedAtMs: number): GameSession {
	if (session.startedAtMs !== null) return session;

	return {
		...session,
		startedAtMs,
		finishedAtMs: null
	};
}

export function finishSession(session: GameSession, finishedAtMs: number): GameSession {
	if (session.finishedAtMs !== null) return session;

	const startedAtMs = session.startedAtMs ?? finishedAtMs;

	return {
		...session,
		startedAtMs,
		finishedAtMs: Math.max(finishedAtMs, startedAtMs)
	};
}

export function applySessionInput(
	session: GameSession,
	attempt: string,
	inputAtMs: number
): GameSession {
	if (isTypingDisabled(session)) return session;

	const startedSession = session.startedAtMs === null ? startSession(session, inputAtMs) : session;
	return {
		...startedSession,
		attempt
	};
}

export function getElapsedSeconds(session: GameSession, nowMs: number): number {
	if (session.startedAtMs === null) return 0;

	const endMs = session.finishedAtMs ?? nowMs;
	return Math.max(0, (endMs - session.startedAtMs) / 1000);
}

export function getScoringElapsedSeconds(session: GameSession, nowMs: number): number {
	return Math.max(getElapsedSeconds(session, nowMs), MIN_SCORING_SECONDS);
}

export function getSessionPhase(session: GameSession): GameSessionPhase {
	if (isSessionFinished(session)) return 'finished';
	if (isSessionStarted(session)) return 'running';
	return 'idle';
}

export function isSessionStarted(session: GameSession): boolean {
	return session.startedAtMs !== null;
}

export function isSessionRunning(session: GameSession): boolean {
	return isSessionStarted(session) && !isSessionFinished(session);
}

export function isSessionFinished(session: GameSession): boolean {
	return session.finishedAtMs !== null;
}

export function hasSessionActivity(session: GameSession): boolean {
	return (
		session.attempt.length > 0 || session.startedAtMs !== null || session.finishedAtMs !== null
	);
}

export function isTypingDisabled(session: GameSession): boolean {
	return isSessionFinished(session);
}

export function areModeControlsDisabled(session: GameSession): boolean {
	return isSessionRunning(session);
}

export function arePromptControlsDisabled(session: GameSession): boolean {
	return isSessionRunning(session);
}

export function getSessionControlState(session: GameSession): SessionControlState {
	const running = isSessionRunning(session);
	const finished = isSessionFinished(session);

	return {
		typingDisabled: finished,
		finishDisabled: finished,
		resetDisabled: !hasSessionActivity(session),
		modeSelectionDisabled: running,
		promptSelectionDisabled: running
	};
}

export function calculateSessionResult(session: GameSession, nowMs: number): GameSessionResult {
	const mode = getGameMode(session.modeId);
	const prompt = getPrompt(session.modeId, session.promptId);
	const elapsedSeconds = getElapsedSeconds(session, nowMs);
	const scoringElapsedSeconds = getScoringElapsedSeconds(session, nowMs);

	return {
		mode,
		prompt,
		phase: getSessionPhase(session),
		attempt: session.attempt,
		elapsedSeconds,
		scoringElapsedSeconds,
		score: scoreAttempt(prompt.text, session.attempt, scoringElapsedSeconds)
	};
}
