# Alkotype

A static SvelteKit typing game prototype: **Monkeytype, but typo-tolerant and vibe-aware**.

The product promise is simple: players type fast, mistakes are allowed, and the score rewards text that stays close to the original idea rather than matching every character exactly.

## Current scaffold

- SvelteKit + Svelte 5 runes
- Tailwind CSS 4
- Static adapter with SPA fallback (`build/200.html`)
- Pure scoring subsystem in `src/lib/scoring`
- Vitest unit tests for deterministic fallback and mocked semantic scoring
- Nginx Dockerfile for static hosting

## Commands

```sh
npm install
npm run dev
npm run check
npm run test
npm run build
```

## Static Docker image

```sh
docker build -t alkotype .
docker run --rm -p 8080:80 alkotype
```

Then open <http://localhost:8080>.

## Scoring subsystem

Gameplay calls `scoreAttempt(source, attempt, elapsedSeconds)`, a synchronous, backend-free, deterministic fallback scorer. It returns explicit components for `overall`, `wpm`, `effectiveWpm`, `wholeTextSimilarity`, `contentWordCoverage`, `chunkSimilarity`, and `lengthFitness`.

Fallback weights are exported as `FALLBACK_SCORING_WEIGHTS`:

1. whole text typo-tolerant similarity: `0.25`;
2. meaningful content-word fuzzy coverage: `0.35`;
3. source-guided chunk similarity: `0.25`;
4. length fit: `0.15`.

Chunking splits source text on sentence punctuation or newlines when present. If punctuation is missing, it falls back to approximate 8-12 word windows with a target of 10 words. Attempts with missing or mismatched punctuation are split using the source shape and compared against same-index plus nearby chunks, so missing periods do not dominate the score.

`scoreAttemptWithEmbeddings(...)` is the async semantic-ready API. It accepts an optional `EmbeddingProvider` with `embed(texts: string[]): Promise<number[][]>`. With no provider, provider errors, malformed vectors, or unavailable browser/model support, it returns the deterministic fallback and marks the status (`fallback-no-provider`, `fallback-provider-error`, or `fallback-malformed-vectors`). `createLazyEmbeddingProvider(...)` provides a small seam for future browser-local worker/model loaders: it loads on first embed, caches successful loads, exposes available metadata, and lets loader/model failures fall back through the scorer.

Semantic-provider weights are exported as `SEMANTIC_SCORING_WEIGHTS`:

1. whole-text semantic cosine similarity: `0.35`;
2. chunk semantic cosine similarity: `0.30`;
3. content-word fuzzy coverage: `0.15`;
4. lexical whole-text fallback similarity: `0.10`;
5. length fit: `0.10`.

The optional endpoint provider helper posts `{ texts: string[], model?: string }` and expects `{ embeddings: number[][], model?: string, dimensions?: number, normalized?: boolean }`. Endpoint use can improve semantic quality but may send prompt/attempt text over the network and adds latency, so the default static game does not configure one. Browser-local model loading, such as a future `@huggingface/transformers` worker behind the lazy provider helper, is intentionally deferred to avoid bundling large model dependencies in this stage.
