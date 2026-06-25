<script lang="ts">
	import { scoreAttempt } from '$lib/scoring';

	type Challenge = {
		title: string;
		text: string;
	};

	const CHALLENGES: Challenge[] = [
		{
			title: 'Morning Product Meeting',
			text: 'The team wanted a typing game where mistakes are allowed, speed matters, and the result only needs to stay recognizably close to the original idea.'
		},
		{
			title: 'Late Night Algorithm',
			text: 'Instead of punishing every typo, Alkotype compares the whole text, ten word chunks, and meaningful content words to reward fast approximate writing.'
		},
		{
			title: 'Deployment Toast',
			text: 'A tiny static Svelte app can be built once, served from Nginx, and played without accounts, payments, databases, or any sober backend ceremony.'
		}
	];

	let selectedChallenge = $state(0);
	let answer = $state('');
	let startedAt = $state<number | null>(null);
	let finishedAt = $state<number | null>(null);
	let now = $state(Date.now());

	const challenge = $derived(CHALLENGES[selectedChallenge]);
	const elapsedSeconds = $derived(
		startedAt === null ? 0 : Math.max(0, ((finishedAt ?? now) - startedAt) / 1000)
	);
	const score = $derived(scoreAttempt(challenge.text, answer, Math.max(elapsedSeconds, 1)));
	const hasStarted = $derived(startedAt !== null);
	const isFinished = $derived(finishedAt !== null);

	$effect(() => {
		if (startedAt === null || finishedAt !== null) return;

		const interval = window.setInterval(() => {
			now = Date.now();
		}, 100);

		return () => window.clearInterval(interval);
	});

	function startIfNeeded() {
		if (startedAt !== null) return;
		startedAt = Date.now();
		now = startedAt;
	}

	function finishAttempt() {
		startIfNeeded();
		finishedAt = Date.now();
		now = finishedAt;
	}

	function resetAttempt() {
		answer = '';
		startedAt = null;
		finishedAt = null;
		now = Date.now();
	}

	function selectChallenge(index: number) {
		selectedChallenge = index;
		resetAttempt();
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
						Type as fast as possible. Exact spelling is optional; the prototype rewards text that
						stays close to the original by whole-text similarity, source-guided chunks, and
						meaningful content words.
					</p>
				</div>
				<div
					class="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100"
				>
					<p class="font-semibold text-amber-200">MVP scoring note</p>
					<p class="mt-2 leading-6">
						Live gameplay stays fully static and uses deterministic fallback scoring. The scoring
						subsystem now has an optional semantic-provider API for whole-text and chunk embeddings,
						but no provider is configured by default.
					</p>
				</div>
			</div>
		</header>

		<div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
			<aside class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-5">
				<h2 class="text-lg font-bold">Prompt</h2>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each CHALLENGES as item, index (item.title)}
						<button
							class="rounded-full border px-3 py-1.5 text-sm transition {selectedChallenge === index
								? 'border-amber-300 bg-amber-300 text-zinc-950'
								: 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/30'}"
							type="button"
							onclick={() => selectChallenge(index)}
						>
							{item.title}
						</button>
					{/each}
				</div>
				<blockquote class="mt-5 rounded-3xl bg-black/30 p-5 text-xl leading-9 text-zinc-100">
					{challenge.text}
				</blockquote>
				<p class="mt-4 text-sm leading-6 text-zinc-400">
					Press any key in the typing area to start the timer. Click “finish” when the vibe is close
					enough.
				</p>
			</aside>

			<section class="rounded-[1.5rem] border border-white/10 bg-zinc-900/80 p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="text-lg font-bold">Attempt</h2>
					<div class="flex gap-2">
						<button
							class="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200"
							type="button"
							onclick={finishAttempt}
						>
							Finish
						</button>
						<button
							class="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-white/30"
							type="button"
							onclick={resetAttempt}
						>
							Reset
						</button>
					</div>
				</div>

				<textarea
					class="mt-4 min-h-56 w-full resize-y rounded-3xl border border-white/10 bg-black/40 p-5 text-lg leading-8 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300"
					placeholder="Start typing here. Typos are fine, betrayal is not."
					bind:value={answer}
					disabled={isFinished}
					oninput={startIfNeeded}></textarea>

				<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-2xl bg-black/30 p-4">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">time</p>
						<p class="mt-1 text-2xl font-black">{formatSeconds(elapsedSeconds)}s</p>
					</div>
					<div class="rounded-2xl bg-black/30 p-4">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">wpm</p>
						<p class="mt-1 text-2xl font-black">{score.wpm}</p>
					</div>
					<div class="rounded-2xl bg-black/30 p-4">
						<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">similarity</p>
						<p class="mt-1 text-2xl font-black">{score.overall}%</p>
					</div>
					<div class="rounded-2xl bg-amber-300 p-4 text-zinc-950">
						<p class="text-xs font-bold uppercase tracking-[0.2em] text-zinc-700">effective</p>
						<p class="mt-1 text-2xl font-black">{score.effectiveWpm}</p>
					</div>
				</div>

				<div class="mt-5 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
					<p class="rounded-2xl border border-white/10 p-3">
						Whole text: {score.wholeTextSimilarity}%
					</p>
					<p class="rounded-2xl border border-white/10 p-3">
						Content words: {score.contentWordCoverage}%
					</p>
					<p class="rounded-2xl border border-white/10 p-3">
						Chunk order: {score.chunkSimilarity}%
					</p>
					<p class="rounded-2xl border border-white/10 p-3">Length fit: {score.lengthFitness}%</p>
				</div>

				{#if !hasStarted}
					<p class="mt-4 text-sm text-zinc-500">Timer is idle.</p>
				{:else if isFinished}
					<p class="mt-4 text-sm text-emerald-300">Finished. Reset or pick another prompt.</p>
				{:else}
					<p class="mt-4 text-sm text-amber-300">
						Timer running. Keep the meaning, ignore perfection.
					</p>
				{/if}
			</section>
		</div>
	</section>
</main>
