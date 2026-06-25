<script lang="ts">
	import {
		GAME_MODES,
		applySessionInput,
		calculateSessionResult,
		createGameSession,
		finishSession,
		getGameMode,
		getSessionControlState,
		resetSession,
		selectNextSessionPrompt,
		selectSessionMode,
		selectSessionPrompt,
		type GameModeId,
		type PromptId
	} from '$lib/game';

	let session = $state(createGameSession());
	let now = $state(Date.now());

	const controls = $derived(getSessionControlState(session));
	const selectedMode = $derived(getGameMode(session.modeId));
	const result = $derived(calculateSessionResult(session, now));

	$effect(() => {
		if (session.startedAtMs === null || session.finishedAtMs !== null) return;

		const interval = window.setInterval(() => {
			now = Date.now();
		}, 100);

		return () => window.clearInterval(interval);
	});

	function updateNow(): number {
		now = Date.now();
		return now;
	}

	function selectMode(modeId: GameModeId) {
		if (controls.modeSelectionDisabled) return;
		session = selectSessionMode(session, modeId);
		updateNow();
	}

	function selectPrompt(promptId: PromptId) {
		if (controls.promptSelectionDisabled) return;
		session = selectSessionPrompt(session, promptId);
		updateNow();
	}

	function selectNextPrompt() {
		if (controls.promptSelectionDisabled) return;
		session = selectNextSessionPrompt(session);
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
		session = finishSession(session, finishedAtMs);
		now = finishedAtMs;
	}

	function resetAttempt() {
		if (controls.resetDisabled) return;

		session = resetSession(session);
		updateNow();
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

	function formatSeconds(seconds: number): string {
		return seconds.toFixed(1);
	}
</script>

<svelte:head>
	<title>Alkotype — typo-tolerant speed typing</title>
	<meta
		name="description"
		content="A static Svelte prototype for semantic-ish, typo-tolerant speed typing."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeyboardShortcut} />

<main class="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
	<section class="mx-auto flex max-w-6xl flex-col gap-8">
		<header
			class="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8"
		>
			<p class="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Alkotype</p>
			<div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
				<div>
					<h1 class="text-4xl font-black tracking-tight sm:text-6xl">
						Monkeytype, but the keyboard had a drink.
					</h1>
					<p class="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
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

		<div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
			<aside class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-5">
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
							class="rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 {session.modeId ===
							mode.id
								? 'border-amber-300 bg-amber-300 text-zinc-950'
								: 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/30'}"
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
						class="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-45"
						type="button"
						disabled={controls.promptSelectionDisabled}
						onclick={selectNextPrompt}
					>
						New prompt
					</button>
				</div>

				<div class="mt-4 grid gap-2">
					{#each selectedMode.prompts as prompt (prompt.id)}
						<button
							class="rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 {session.promptId ===
							prompt.id
								? 'border-amber-300/80 bg-white/10 text-white'
								: 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/30'}"
							type="button"
							disabled={controls.promptSelectionDisabled}
							aria-pressed={session.promptId === prompt.id}
							onclick={() => selectPrompt(prompt.id)}
						>
							<span class="block font-bold">{prompt.title}</span>
							<span class="mt-1 block text-sm text-zinc-400">{prompt.description}</span>
							<span class="mt-3 flex flex-wrap gap-1">
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

				<blockquote class="mt-5 rounded-3xl bg-black/30 p-5 text-xl leading-9 text-zinc-100">
					{result.prompt.text}
				</blockquote>
			</aside>

			<section class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-lg font-bold">Attempt</h2>
						<p class="mt-1 text-sm text-zinc-400">{selectedMode.tone.finishHelp}</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							class="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
							type="button"
							disabled={controls.finishDisabled}
							onclick={finishAttempt}
						>
							Finish
						</button>
						<button
							class="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-45"
							type="button"
							disabled={controls.resetDisabled}
							onclick={resetAttempt}
						>
							Reset
						</button>
						<button
							class="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200 transition hover:border-amber-300/70 disabled:cursor-not-allowed disabled:opacity-45"
							type="button"
							disabled={controls.promptSelectionDisabled}
							onclick={selectNextPrompt}
						>
							New prompt
						</button>
					</div>
				</div>

				<textarea
					class="mt-4 min-h-56 w-full resize-y rounded-3xl border border-white/10 bg-black/40 p-5 text-lg leading-8 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
					placeholder={selectedMode.tone.placeholder}
					value={session.attempt}
					disabled={controls.typingDisabled}
					oninput={updateAttempt}></textarea>

				<div class="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
					{#if result.phase === 'idle'}
						<p>Timer is idle. Typing in the box starts the run.</p>
					{:else if result.phase === 'finished'}
						<p class="font-semibold text-emerald-300">
							Finished. The typing box and Finish button are locked; reset or choose another prompt.
						</p>
					{:else}
						<p class="font-semibold text-amber-300">
							Timer running. Mode and prompt switching are locked until you finish or reset.
						</p>
					{/if}
					<p class="mt-2 text-zinc-500">
						Shortcuts: Ctrl/Cmd+Enter finish, Escape reset, Alt+N new prompt.
					</p>
				</div>

				<section class="mt-5" aria-live={result.phase === 'finished' ? 'polite' : 'off'}>
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 class="text-lg font-bold">
								{result.phase === 'finished' ? 'Final result' : 'Live result'}
							</h2>
							<p class="mt-1 text-sm text-zinc-400">{selectedMode.tone.resultCallout}</p>
						</div>
						<p class="rounded-full bg-black/30 px-3 py-1.5 text-sm text-zinc-300">
							{formatSeconds(result.elapsedSeconds)}s elapsed
						</p>
					</div>

					<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div class="rounded-2xl bg-black/30 p-4">
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">score.overall</p>
							<p class="mt-1 text-2xl font-black">{result.score.overall}%</p>
						</div>
						<div class="rounded-2xl bg-black/30 p-4">
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">wpm</p>
							<p class="mt-1 text-2xl font-black">{result.score.wpm}</p>
						</div>
						<div class="rounded-2xl bg-amber-300 p-4 text-zinc-950">
							<p class="text-xs font-bold uppercase tracking-[0.2em] text-zinc-700">effectiveWpm</p>
							<p class="mt-1 text-2xl font-black">{result.score.effectiveWpm}</p>
						</div>
						<div class="rounded-2xl bg-black/30 p-4">
							<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">scoring time</p>
							<p class="mt-1 text-2xl font-black">
								{formatSeconds(result.scoringElapsedSeconds)}s
							</p>
						</div>
					</div>

					<div class="mt-3 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
						<p class="rounded-2xl border border-white/10 p-3">
							Whole text similarity: {result.score.wholeTextSimilarity}%
						</p>
						<p class="rounded-2xl border border-white/10 p-3">
							Content word coverage: {result.score.contentWordCoverage}%
						</p>
						<p class="rounded-2xl border border-white/10 p-3">
							Chunk similarity: {result.score.chunkSimilarity}%
						</p>
						<p class="rounded-2xl border border-white/10 p-3">
							Length fitness: {result.score.lengthFitness}%
						</p>
					</div>
				</section>
			</section>
		</div>
	</section>
</main>
