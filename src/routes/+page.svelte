<script lang="ts">
	import { tick } from 'svelte';
	import {
		GAME_MODES,
		addRunHistoryEntry,
		applySessionInput,
		calculateSessionResult,
		createGameSession,
		createRunHistoryEntry,
		finishSession,
		getGameMode,
		getSessionControlState,
		loadRunHistory,
		resetSession,
		saveRunHistory,
		selectNextSessionPrompt,
		selectSessionMode,
		selectSessionPrompt,
		summarizeRunHistoryEntry,
		type GameModeId,
		type GameSessionResult,
		type PromptId,
		type RunHistoryEntry
	} from '$lib/game';

	const focusRing =
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';
	const softButton = `${focusRing} rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45`;
	const amberButton = `${focusRing} rounded-full border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200 transition hover:border-amber-300/70 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-45`;
	const primaryButton = `${focusRing} rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45`;

	let session = $state(createGameSession());
	let now = $state(Date.now());
	let history = $state<RunHistoryEntry[]>([]);
	let historyStatus = $state('History stays local to this browser.');
	let shareStatus = $state('');
	let attemptInput: HTMLTextAreaElement | undefined = undefined;

	const controls = $derived(getSessionControlState(session));
	const selectedMode = $derived(getGameMode(session.modeId));
	const result = $derived(calculateSessionResult(session, now));
	const latestFinishedEntry = $derived(
		result.phase === 'finished' && session.finishedAtMs !== null
			? createRunHistoryEntry(result, session.finishedAtMs)
			: null
	);
	const scoreComponents = $derived([
		{
			label: 'Whole text similarity',
			value: result.score.wholeTextSimilarity,
			description: 'Does the whole attempt still resemble the prompt?'
		},
		{
			label: 'Content word coverage',
			value: result.score.contentWordCoverage,
			description: 'Did the important nouns and verbs survive the wobble?'
		},
		{
			label: 'Chunk similarity',
			value: result.score.chunkSimilarity,
			description: 'Are nearby phrase chunks telling the same story?'
		},
		{
			label: 'Length fitness',
			value: result.score.lengthFitness,
			description: 'Is the attempt about the right size, not a one-word hiccup?'
		}
	]);

	$effect(() => {
		if (session.startedAtMs === null || session.finishedAtMs !== null) return;

		const interval = window.setInterval(() => {
			now = Date.now();
		}, 100);

		return () => window.clearInterval(interval);
	});

	$effect(() => {
		const loadedHistory = loadRunHistory(window.localStorage);
		history = loadedHistory;
		historyStatus =
			loadedHistory.length === 0
				? 'No saved runs yet. Finish one and it will survive reloads on this device.'
				: `Loaded ${loadedHistory.length} local run${loadedHistory.length === 1 ? '' : 's'}.`;
	});

	function updateNow(): number {
		now = Date.now();
		return now;
	}

	function selectMode(modeId: GameModeId) {
		if (controls.modeSelectionDisabled) return;
		session = selectSessionMode(session, modeId);
		shareStatus = '';
		updateNow();
	}

	function selectPrompt(promptId: PromptId) {
		if (controls.promptSelectionDisabled) return;
		session = selectSessionPrompt(session, promptId);
		shareStatus = '';
		updateNow();
	}

	function selectNextPrompt() {
		if (controls.promptSelectionDisabled) return;
		session = selectNextSessionPrompt(session);
		shareStatus = '';
		updateNow();
	}

	function updateAttempt(event: Event) {
		const input = event.currentTarget as HTMLTextAreaElement;
		const inputAtMs = Date.now();

		session = applySessionInput(session, input.value, inputAtMs);
		now = inputAtMs;
	}

	function finishAttempt() {
		if (controls.finishDisabled) return;

		const finishedAtMs = Date.now();
		const finishedSession = finishSession(session, finishedAtMs);
		const finishedResult = calculateSessionResult(finishedSession, finishedAtMs);
		session = finishedSession;
		now = finishedAtMs;
		recordFinishedRun(finishedResult, finishedAtMs);
		shareStatus = 'Finished. Copy the bar-napkin brag if this run deserves witnesses.';
	}

	function resetAttempt() {
		if (controls.resetDisabled) return;

		session = resetSession(session);
		shareStatus = '';
		updateNow();
	}

	function playAgainSamePrompt() {
		resetAttempt();
		focusAttemptInput();
	}

	function playAgainNewPrompt() {
		if (controls.promptSelectionDisabled) return;

		session = selectNextSessionPrompt(session);
		shareStatus = '';
		updateNow();
		focusAttemptInput();
	}

	async function copyResultSummary() {
		if (!latestFinishedEntry) {
			shareStatus = 'Finish a run before copying a score summary.';
			return;
		}

		if (!navigator.clipboard?.writeText) {
			shareStatus = 'Copy is unavailable in this browser. The result is still saved locally.';
			return;
		}

		try {
			await navigator.clipboard.writeText(summarizeRunHistoryEntry(latestFinishedEntry));
			shareStatus = 'Copied. Paste responsibly; the keyboard may deny everything.';
		} catch {
			shareStatus = 'Copy failed. Browser permissions said last call.';
		}
	}

	function recordFinishedRun(finishedResult: GameSessionResult, finishedAtMs: number) {
		const entry = createRunHistoryEntry(finishedResult, finishedAtMs);
		const nextHistory = addRunHistoryEntry(history, entry);

		try {
			history = saveRunHistory(window.localStorage, nextHistory);
			historyStatus =
				'Saved this run locally. No server, no account, no suspicious clipboard bouncer.';
		} catch {
			history = nextHistory;
			historyStatus =
				'Run kept on this page, but localStorage is blocked or full so it may not survive reload.';
		}
	}

	function handleKeyboardShortcut(event: KeyboardEvent) {
		if (event.defaultPrevented) return;

		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			finishAttempt();
			return;
		}

		if (event.key === 'Escape') {
			if (controls.resetDisabled) return;
			event.preventDefault();
			resetAttempt();
			return;
		}

		if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') {
			event.preventDefault();
			selectNextPrompt();
		}
	}

	function focusAttemptInput() {
		void tick().then(() => attemptInput?.focus());
	}

	function formatSeconds(seconds: number): string {
		return `${seconds.toFixed(1)}s`;
	}

	function formatNumber(value: number): string {
		return Number.isInteger(value) ? value.toString() : value.toFixed(1);
	}

	function formatPercent(value: number): string {
		return `${formatNumber(value)}%`;
	}

	function formatHistoryTime(timestampMs: number): string {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(timestampMs));
	}
</script>

<svelte:head>
	<title>Alkotype - typo-tolerant speed typing</title>
	<meta
		name="description"
		content="A static Svelte prototype for semantic-ish, typo-tolerant speed typing."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeyboardShortcut} />

<main class="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-8 lg:px-8">
	<section class="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-8">
		<header
			class="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 sm:p-8"
		>
			<p class="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Alkotype</p>
			<div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
				<div>
					<h1 class="text-4xl font-black tracking-tight text-balance sm:text-6xl">
						Monkeytype, but the keyboard had a drink.
					</h1>
					<p class="mt-5 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
						Pick a mode, choose a prompt, type fast, and finish when your attempt still sounds like
						the original idea. Everything runs locally with deterministic fallback scoring.
					</p>
				</div>
				<div
					class="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100"
				>
					<p class="font-semibold text-amber-200">Keyboard flow</p>
					<div class="mt-3 grid gap-2 leading-6">
						<p><kbd class="font-bold text-amber-200">Ctrl/Cmd+Enter</kbd> finishes the run.</p>
						<p><kbd class="font-bold text-amber-200">Escape</kbd> resets the current attempt.</p>
						<p><kbd class="font-bold text-amber-200">Alt+N</kbd> moves to the next prompt.</p>
					</div>
				</div>
			</div>
		</header>

		<div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
			<aside class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-4 sm:p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-lg font-bold">Mode</h2>
						<p class="mt-1 text-sm text-zinc-400">{selectedMode.tone.summary}</p>
					</div>
					{#if controls.modeSelectionDisabled}
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
							Locked while running
						</p>
					{/if}
				</div>

				<div class="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
					{#each GAME_MODES as mode (mode.id)}
						<button
							class="{focusRing} rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 {session.modeId ===
							mode.id
								? 'border-amber-300 bg-amber-300 text-zinc-950'
								: 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/30 hover:bg-white/10'}"
							type="button"
							disabled={controls.modeSelectionDisabled}
							aria-pressed={session.modeId === mode.id}
							onclick={() => selectMode(mode.id)}
						>
							<span class="block font-bold">{mode.label}</span>
							<span class="mt-1 block text-sm opacity-80">{mode.description}</span>
						</button>
					{/each}
				</div>

				<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-lg font-bold">Prompt</h2>
						<p class="mt-1 text-sm text-zinc-400">{selectedMode.helpText}</p>
					</div>
					<button
						class={softButton}
						type="button"
						disabled={controls.promptSelectionDisabled}
						aria-label="Choose the next prompt"
						onclick={selectNextPrompt}
					>
						New prompt
					</button>
				</div>

				<div class="mt-4 grid gap-2">
					{#each selectedMode.prompts as prompt (prompt.id)}
						<button
							class="{focusRing} rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 {session.promptId ===
							prompt.id
								? 'border-amber-300/80 bg-white/10 text-white'
								: 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/30 hover:bg-white/5'}"
							type="button"
							disabled={controls.promptSelectionDisabled}
							aria-pressed={session.promptId === prompt.id}
							onclick={() => selectPrompt(prompt.id)}
						>
							<span class="block font-bold">{prompt.title}</span>
							<span class="mt-1 block text-sm text-zinc-400">{prompt.description}</span>
							<span class="mt-3 flex flex-wrap gap-1" aria-label="Prompt tags">
								{#each prompt.tags as tag (tag)}
									<span
										class="rounded-full border border-white/10 px-2 py-0.5 text-xs uppercase tracking-[0.15em] text-zinc-500"
									>
										{tag}
									</span>
								{/each}
							</span>
						</button>
					{/each}
				</div>

				<blockquote
					class="mt-5 rounded-3xl border border-white/10 bg-black/30 p-5 text-lg leading-8 text-zinc-100 sm:text-xl sm:leading-9"
				>
					<p class="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Prompt text</p>
					{result.prompt.text}
				</blockquote>
			</aside>

			<div class="grid gap-6">
				<section
					class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-4 sm:p-5"
					aria-labelledby="attempt-heading"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 id="attempt-heading" class="text-lg font-bold">Attempt</h2>
							<p id="attempt-help" class="mt-1 text-sm text-zinc-400">
								{selectedMode.tone.finishHelp}
							</p>
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								class={primaryButton}
								type="button"
								disabled={controls.finishDisabled}
								aria-label="Finish this run"
								onclick={finishAttempt}
							>
								Finish
							</button>
							<button
								class={softButton}
								type="button"
								disabled={controls.resetDisabled}
								aria-label="Reset this attempt"
								onclick={resetAttempt}
							>
								Reset
							</button>
							<button
								class={amberButton}
								type="button"
								disabled={controls.promptSelectionDisabled}
								aria-label="Switch to a new prompt"
								onclick={selectNextPrompt}
							>
								New prompt
							</button>
						</div>
					</div>

					<label class="sr-only" for="attempt-input">Your typed attempt</label>
					<textarea
						id="attempt-input"
						bind:this={attemptInput}
						class="mt-4 min-h-52 w-full resize-y rounded-3xl border border-white/10 bg-black/40 p-4 text-base leading-8 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-60 sm:p-5 sm:text-lg"
						placeholder={selectedMode.tone.placeholder}
						value={session.attempt}
						disabled={controls.typingDisabled}
						aria-describedby="attempt-help attempt-status"
						oninput={updateAttempt}></textarea>

					<div
						id="attempt-status"
						class="mt-4 rounded-3xl border p-4 text-sm sm:p-5 {result.phase === 'finished'
							? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
							: result.phase === 'running'
								? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
								: 'border-white/10 bg-black/20 text-zinc-300'}"
						role="status"
						aria-live="polite"
					>
						{#if result.phase === 'idle'}
							<p class="font-semibold text-zinc-100">Empty glass. Timer is idle.</p>
							<p class="mt-1 text-zinc-400">
								Start typing to begin. Finish when the idea is close enough to stand upright.
							</p>
						{:else if result.phase === 'finished'}
							<p class="font-semibold text-emerald-200">
								Finished. The run is frozen and saved locally.
							</p>
							<p class="mt-1 text-emerald-100/80">
								Play the same prompt again, grab a fresh prompt, or copy the score summary.
							</p>
						{:else}
							<p class="font-semibold text-amber-200">Timer running. The keyboard is wobbling.</p>
							<p class="mt-1 text-amber-100/80">
								Mode and prompt switching are locked until you finish or reset.
							</p>
						{/if}
						<p class="mt-3 text-xs text-zinc-500">
							Shortcuts: Ctrl/Cmd+Enter finish, Escape reset, Alt+N new prompt.
						</p>
					</div>

					<section
						class="mt-5"
						aria-live={result.phase === 'finished' ? 'polite' : 'off'}
						aria-labelledby="result-heading"
					>
						<div class="flex flex-wrap items-end justify-between gap-3">
							<div>
								<h2 id="result-heading" class="text-lg font-bold">
									{result.phase === 'finished'
										? 'Final result'
										: result.phase === 'running'
											? 'Live readout'
											: 'Waiting for a run'}
								</h2>
								<p class="mt-1 text-sm text-zinc-400">{selectedMode.tone.resultCallout}</p>
							</div>
							<p class="rounded-full bg-black/30 px-3 py-1.5 text-sm text-zinc-300">
								{formatSeconds(result.elapsedSeconds)} elapsed
							</p>
						</div>

						{#if result.phase === 'idle'}
							<div class="mt-4 rounded-3xl border border-dashed border-white/15 bg-black/20 p-6">
								<p class="text-2xl font-black">No score yet.</p>
								<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
									Your raw WPM, similarity, effective WPM, timing, and component breakdown will
									appear here after the first keystroke and lock in when you finish.
								</p>
							</div>
						{:else}
							<div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<div class="rounded-2xl bg-black/30 p-4">
									<p class="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Raw WPM</p>
									<p class="mt-1 text-3xl font-black">{formatNumber(result.score.wpm)}</p>
									<p class="mt-2 text-xs leading-5 text-zinc-500">
										Speed before similarity sobers it up.
									</p>
								</div>
								<div class="rounded-2xl bg-black/30 p-4">
									<p class="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
										Similarity
									</p>
									<p class="mt-1 text-3xl font-black" data-testid="similarity-value">
										{formatPercent(result.score.overall)}
									</p>
									<p class="mt-2 text-xs leading-5 text-zinc-500">
										Overall closeness to the prompt.
									</p>
								</div>
								<div class="rounded-2xl bg-amber-300 p-4 text-zinc-950">
									<p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-700">
										Effective WPM
									</p>
									<p class="mt-1 text-3xl font-black" data-testid="effective-wpm-value">
										{formatNumber(result.score.effectiveWpm)}
									</p>
									<p class="mt-2 text-xs leading-5 text-zinc-700">
										Raw speed multiplied by meaning.
									</p>
								</div>
								<div class="rounded-2xl bg-black/30 p-4">
									<p class="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Timing</p>
									<p class="mt-1 text-3xl font-black">{formatSeconds(result.elapsedSeconds)}</p>
									<p class="mt-2 text-xs leading-5 text-zinc-500">
										{formatSeconds(result.scoringElapsedSeconds)} scoring time minimum.
									</p>
								</div>
							</div>

							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								{#each scoreComponents as component (component.label)}
									<div class="rounded-2xl border border-white/10 bg-black/20 p-4">
										<div class="flex items-center justify-between gap-3">
											<p class="font-semibold text-zinc-100">{component.label}</p>
											<p class="text-lg font-black text-amber-200">
												{formatPercent(component.value)}
											</p>
										</div>
										<div class="mt-3 h-2 rounded-full bg-white/10" aria-hidden="true">
											<div
												class="h-2 rounded-full bg-amber-300"
												style={`width: ${component.value}%`}
											></div>
										</div>
										<p class="mt-2 text-sm leading-6 text-zinc-400">{component.description}</p>
									</div>
								{/each}
							</div>
						{/if}

						{#if result.phase === 'finished'}
							<div
								class="mt-4 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 sm:p-5"
							>
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p class="text-sm font-bold uppercase tracking-[0.2em] text-emerald-200">
											Run complete
										</p>
										<p class="mt-1 text-sm text-emerald-100/80">
											Saved locally as {selectedMode.label} / {result.prompt.title}.
										</p>
									</div>
									<div class="flex flex-wrap gap-2">
										<button class={primaryButton} type="button" onclick={playAgainSamePrompt}>
											Play same prompt
										</button>
										<button class={amberButton} type="button" onclick={playAgainNewPrompt}>
											New prompt run
										</button>
										<button class={softButton} type="button" onclick={copyResultSummary}>
											Copy summary
										</button>
									</div>
								</div>
								<p class="mt-3 text-sm text-emerald-100/80" role="status" aria-live="polite">
									{shareStatus}
								</p>
							</div>
						{/if}
					</section>
				</section>

				<section
					class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-4 sm:p-5"
					aria-labelledby="history-heading"
				>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Local only</p>
							<h2 id="history-heading" class="mt-1 text-lg font-bold">Recent runs</h2>
							<p class="mt-1 text-sm text-zinc-400">
								Kept in localStorage, capped to the latest few bar stories.
							</p>
						</div>
						<p class="rounded-full bg-black/30 px-3 py-1.5 text-sm text-zinc-300">
							{history.length} saved
						</p>
					</div>
					<p class="mt-3 text-sm text-zinc-400" role="status" aria-live="polite">
						{historyStatus}
					</p>

					{#if history.length === 0}
						<div class="mt-4 rounded-3xl border border-dashed border-white/15 bg-black/20 p-5">
							<p class="font-semibold text-zinc-100">No history yet.</p>
							<p class="mt-2 text-sm leading-6 text-zinc-400">
								Finish a run and this browser will remember it after reload. Incognito tabs may
								forget faster than a keyboard at last call.
							</p>
						</div>
					{:else}
						<div class="mt-4 grid gap-3">
							{#each history as entry (entry.id)}
								<article class="rounded-3xl border border-white/10 bg-black/20 p-4">
									<div class="flex flex-wrap items-start justify-between gap-3">
										<div>
											<h3 class="font-bold text-zinc-100">{entry.promptTitle}</h3>
											<p class="mt-1 text-sm text-zinc-400">
												{entry.modeLabel} mode - {formatHistoryTime(entry.finishedAtMs)}
											</p>
										</div>
										<p
											class="rounded-full bg-amber-300 px-3 py-1.5 text-sm font-black text-zinc-950"
										>
											{formatNumber(entry.effectiveWpm)} effective WPM
										</p>
									</div>
									<div class="mt-4 grid gap-2 text-sm sm:grid-cols-4">
										<p class="rounded-2xl bg-white/5 p-3">
											<span class="block text-xs uppercase tracking-[0.16em] text-zinc-500"
												>Raw WPM</span
											>
											<span class="mt-1 block text-lg font-black">{formatNumber(entry.rawWpm)}</span
											>
										</p>
										<p class="rounded-2xl bg-white/5 p-3">
											<span class="block text-xs uppercase tracking-[0.16em] text-zinc-500"
												>Similarity</span
											>
											<span class="mt-1 block text-lg font-black"
												>{formatPercent(entry.similarity)}</span
											>
										</p>
										<p class="rounded-2xl bg-white/5 p-3">
											<span class="block text-xs uppercase tracking-[0.16em] text-zinc-500"
												>Elapsed</span
											>
											<span class="mt-1 block text-lg font-black"
												>{formatSeconds(entry.elapsedSeconds)}</span
											>
										</p>
										<p class="rounded-2xl bg-white/5 p-3">
											<span class="block text-xs uppercase tracking-[0.16em] text-zinc-500"
												>Scoring time</span
											>
											<span class="mt-1 block text-lg font-black"
												>{formatSeconds(entry.scoringElapsedSeconds)}</span
											>
										</p>
									</div>
									<div class="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-4">
										<p>Whole text: {formatPercent(entry.components.wholeTextSimilarity)}</p>
										<p>Content words: {formatPercent(entry.components.contentWordCoverage)}</p>
										<p>Chunks: {formatPercent(entry.components.chunkSimilarity)}</p>
										<p>Length fit: {formatPercent(entry.components.lengthFitness)}</p>
									</div>
								</article>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		</div>
	</section>
</main>
