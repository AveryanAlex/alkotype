export const GAME_MODE_IDS = ['classic', 'alco', 'benchmark'] as const;

export type GameModeId = (typeof GAME_MODE_IDS)[number];

export type GameModeSettings = {
	readonly scoring: 'deterministic-fallback';
	readonly timerStartsOn: 'first-input';
	readonly promptRotation: 'manual' | 'fixed-sequence';
	readonly punctuation: 'standard' | 'forgiving' | 'fixed';
	readonly benchmarkStable: boolean;
};

export type GameModeTone = {
	readonly summary: string;
	readonly placeholder: string;
	readonly finishHelp: string;
	readonly resultCallout: string;
};

export type GamePrompt<ModeId extends GameModeId = GameModeId> = {
	readonly id: string;
	readonly modeId: ModeId;
	readonly title: string;
	readonly description: string;
	readonly text: string;
	readonly tags: readonly string[];
	readonly stableForBenchmark?: boolean;
};

export type GameMode<ModeId extends GameModeId = GameModeId> = {
	readonly id: ModeId;
	readonly label: string;
	readonly description: string;
	readonly helpText: string;
	readonly tone: GameModeTone;
	readonly settings: GameModeSettings;
	readonly prompts: readonly GamePrompt<ModeId>[];
};

export const DEFAULT_GAME_MODE_ID = 'classic' satisfies GameModeId;

export const GAME_MODES = [
	{
		id: 'classic',
		label: 'Classic',
		description: 'Forgiving speed typing for clear prompt retelling.',
		helpText:
			'Retype the idea as quickly as you can. Typos are fine when the answer still sounds like the prompt.',
		tone: {
			summary: 'Focused, readable, and typo-tolerant.',
			placeholder: 'Start typing the same idea. Exact spelling is optional.',
			finishHelp: 'Finish when the meaning is close enough.',
			resultCallout: 'Similarity rewards whole text, content words, chunks, and length fit.'
		},
		settings: {
			scoring: 'deterministic-fallback',
			timerStartsOn: 'first-input',
			promptRotation: 'manual',
			punctuation: 'standard',
			benchmarkStable: false
		},
		prompts: [
			{
				id: 'classic-product-meeting',
				modeId: 'classic',
				title: 'Morning Product Meeting',
				description: 'A compact product-promise prompt with forgiving scoring language.',
				text: 'The team wanted a typing game where mistakes are allowed, speed matters, and the result only needs to stay recognizably close to the original idea.',
				tags: ['product', 'scoring'],
				stableForBenchmark: false
			},
			{
				id: 'classic-late-algorithm',
				modeId: 'classic',
				title: 'Late Night Algorithm',
				description: 'Explains the approximate scoring model without demanding exact wording.',
				text: 'Instead of punishing every typo, Alkotype compares the whole text, ten word chunks, and meaningful content words to reward fast approximate writing.',
				tags: ['scoring', 'chunks'],
				stableForBenchmark: false
			},
			{
				id: 'classic-static-toast',
				modeId: 'classic',
				title: 'Deployment Toast',
				description: 'A static-hosting prompt that reinforces the backend-free MVP.',
				text: 'A tiny static Svelte app can be built once, served from Nginx, and played without accounts, payments, databases, or any sober backend ceremony.',
				tags: ['static', 'mvp'],
				stableForBenchmark: false
			}
		]
	},
	{
		id: 'alco',
		label: 'Alco',
		description: 'Messy approximate typing where punctuation and polished endings can wobble.',
		helpText:
			'Keep the major nouns and action intact. Missing punctuation, strange casing, and imperfect endings should not ruin the run.',
		tone: {
			summary: 'Loose, funny, and tolerant of keyboard chaos.',
			placeholder: 'Type the vibe before it falls off the bar stool.',
			finishHelp: 'Finish when a sober friend could recognize the sentence.',
			resultCallout: 'Chunk and content-word overlap matter more than pristine punctuation.'
		},
		settings: {
			scoring: 'deterministic-fallback',
			timerStartsOn: 'first-input',
			promptRotation: 'manual',
			punctuation: 'forgiving',
			benchmarkStable: false
		},
		prompts: [
			{
				id: 'alco-wobbly-keyboard',
				modeId: 'alco',
				title: 'Wobbly Keyboard',
				description: 'A chaotic bar-table scene that should survive typo-heavy retelling.',
				text: 'The keyboard slid sideways while the bartender announced last call, but the heroic typist still explained the launch plan with mostly recognizable words.',
				tags: ['bar', 'launch'],
				stableForBenchmark: false
			},
			{
				id: 'alco-cab-receipt',
				modeId: 'alco',
				title: 'Cab Receipt',
				description: 'A late-night travel prompt with forgiving punctuation expectations.',
				text: 'After midnight the cab receipt looked like a treasure map, yet everyone agreed the app should load offline and score the attempt immediately.',
				tags: ['offline', 'travel'],
				stableForBenchmark: false
			},
			{
				id: 'alco-snack-table',
				modeId: 'alco',
				title: 'Snack Table Strategy',
				description: 'An absurd party prompt that still has clear content words to preserve.',
				text: 'Someone balanced chips on the laptop and declared that approximate typing was a sport for champions who remember the point but not the spelling.',
				tags: ['party', 'approximate'],
				stableForBenchmark: false
			}
		]
	},
	{
		id: 'benchmark',
		label: 'Benchmark',
		description: 'Fixed prompts for comparing deterministic scoring changes over time.',
		helpText:
			'Use these stable prompts when checking whether scorer changes made approximate attempts better, worse, or just different.',
		tone: {
			summary: 'Stable, explicit, and repeatable.',
			placeholder: 'Type against the fixed benchmark text.',
			finishHelp: 'Finish the same way each run so scores are comparable.',
			resultCallout:
				'Benchmark prompt ids and text should change only with deliberate scorer test updates.'
		},
		settings: {
			scoring: 'deterministic-fallback',
			timerStartsOn: 'first-input',
			promptRotation: 'fixed-sequence',
			punctuation: 'fixed',
			benchmarkStable: true
		},
		prompts: [
			{
				id: 'benchmark-product-promise',
				modeId: 'benchmark',
				title: 'Benchmark Product Promise',
				description: 'Stable product wording for scorer regression comparisons.',
				text: 'Alkotype lets a player choose a prompt, type locally, finish the run, and receive a score that combines speed with recognizable meaning.',
				tags: ['benchmark', 'product'],
				stableForBenchmark: true
			},
			{
				id: 'benchmark-static-scoring',
				modeId: 'benchmark',
				title: 'Benchmark Static Scoring',
				description: 'Stable scoring wording with punctuation and content-word variety.',
				text: 'The deterministic fallback compares whole text similarity, meaningful content words, source guided chunks, and length fit without contacting a server.',
				tags: ['benchmark', 'scoring'],
				stableForBenchmark: true
			},
			{
				id: 'benchmark-no-backend',
				modeId: 'benchmark',
				title: 'Benchmark No Backend',
				description: 'Stable static-MVP wording that should remain backend-free.',
				text: 'The MVP stays a static SvelteKit app with no accounts, database, billing system, server scoring, or bundled embedding model dependency.',
				tags: ['benchmark', 'static'],
				stableForBenchmark: true
			}
		]
	}
] as const satisfies readonly [GameMode<'classic'>, GameMode<'alco'>, GameMode<'benchmark'>];

export type GameModeCatalogItem = (typeof GAME_MODES)[number];
export type PromptCatalogItem = GameModeCatalogItem['prompts'][number];
export type PromptId = PromptCatalogItem['id'];

export const PROMPTS: readonly PromptCatalogItem[] = GAME_MODES.flatMap(
	(mode): readonly PromptCatalogItem[] => mode.prompts
);

export function getGameMode(modeId: GameModeId): GameModeCatalogItem {
	const mode = GAME_MODES.find((candidate) => candidate.id === modeId);
	if (!mode) throw new Error(`Unknown game mode: ${modeId}`);
	return mode;
}

export function getPromptsForMode(modeId: GameModeId): readonly PromptCatalogItem[] {
	return getGameMode(modeId).prompts;
}

export function getDefaultPrompt(modeId: GameModeId = DEFAULT_GAME_MODE_ID): PromptCatalogItem {
	const [prompt] = getPromptsForMode(modeId);
	if (!prompt) throw new Error(`Game mode has no prompts: ${modeId}`);
	return prompt;
}

export function getPrompt(modeId: GameModeId, promptId: PromptId): PromptCatalogItem {
	const prompt = getPromptsForMode(modeId).find((candidate) => candidate.id === promptId);
	if (!prompt) throw new Error(`Unknown prompt "${promptId}" for game mode "${modeId}"`);
	return prompt;
}
