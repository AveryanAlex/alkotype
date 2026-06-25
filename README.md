# Alkotype

A static SvelteKit typing game prototype: **Monkeytype, but typo-tolerant and vibe-aware**.

The product promise is simple: players type fast, mistakes are allowed, and the score rewards text that stays close to the original idea rather than matching every character exactly.

## Current scaffold

- SvelteKit + Svelte 5 runes
- Tailwind CSS 4
- Static adapter with SPA fallback (`build/200.html`)
- Local fuzzy scoring prototype in `src/lib/scoring.ts`
- Vitest unit tests for scoring
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

## Scoring direction

The current scorer is deliberately backend-free and deterministic:

1. whole-text typo-tolerant similarity;
2. rough 10-word chunk similarity;
3. meaningful content-word coverage, ignoring very short/common words;
4. length fit;
5. effective WPM = raw WPM × similarity.

The intended next step is a semantic scorer that can run in a static app, likely by using browser-side embeddings or an optional client-provided embedding endpoint. See `docs/product-brief.md`.
