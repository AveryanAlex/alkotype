# Alkotype

A static SvelteKit typing game prototype: **Monkeytype, but typo-tolerant and vibe-aware**.

The product promise is simple: players type fast, mistakes are allowed, and the score rewards text that stays close to the original idea rather than matching every character exactly.

## Current scaffold

- SvelteKit + Svelte 5 runes
- Tailwind CSS 4
- Static adapter with SPA fallback (`build/200.html`)
- Pure scoring subsystem in `src/lib/scoring`
- Vitest unit tests for deterministic fallback and mocked semantic scoring
- Playwright smoke test against the built static app preview
- Nginx Dockerfile for static hosting

## Local Development

```sh
npm install
npm run dev
```

Then open <http://localhost:5173>.

## Checks And Tests

```sh
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run test
npm run build
```

`npm run test` runs the unit suite first, then the Playwright smoke test. The Playwright config builds the static app and serves it with `npm run preview` before launching Chromium, so the smoke exercises the generated SvelteKit output rather than the dev server.

## GitHub Pages Deployment

The production GitHub Pages site is <https://averyanalex.github.io/alkotype/>.

The `CI and Pages` workflow runs `npm run lint`, `npm run check`, `npm run test`, `npm run build`, and `npm run build:pages` for pull requests and pushes to `main`. It uploads the static `build/` artifact and deploys with GitHub Pages Actions only for pushes to `main` or manual workflow dispatch from the `main` branch.

Reproduce the Pages build locally with:

```sh
npm run build:pages
```

`npm run build:pages` runs `BASE_PATH=/alkotype vite build`, so generated asset paths are suitable for the repository Pages URL while the normal `npm run build` remains root-based for local preview, Docker, and smoke tests.

After the first install on a machine without Playwright browsers, run:

```sh
npx playwright install chromium
```

If Linux browser dependency checks fail on a fresh host, install the OS dependencies with:

```sh
npx playwright install --with-deps chromium
```

## Static Docker image

```sh
docker build -t alkotype:local .
docker run --rm -p 8080:80 alkotype:local
```

Then open <http://localhost:8080>.

The image serves the static `build/` output from `/usr/share/nginx/html` with an SPA fallback to `/200.html`. Quick HTTP smoke checks:

```sh
curl -I http://localhost:8080/
curl -I http://localhost:8080/any/client/route
```

Both responses should be `HTTP/1.1 200 OK` from the running container.

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
