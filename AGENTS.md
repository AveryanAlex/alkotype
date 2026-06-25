# Alkotype frontend conventions

This repository is a static SvelteKit SPA. There is intentionally no backend, database, auth, billing, or server-side scoring in the MVP.

## Stack

- SvelteKit / Svelte 5 runes
- TypeScript
- Tailwind CSS 4 through the Vite plugin
- Vitest for unit tests
- `@sveltejs/adapter-static` with `fallback: '200.html'`
- Nginx container only for serving built static files

## Commands

```sh
npm run check
npm run test
npm run build
```

Run all three before handing off code changes.

## Architecture rules

- Keep routes thin enough to compose UI and state; move reusable game/scoring logic into `src/lib`.
- Do not introduce a backend unless a future task explicitly changes the product direction.
- Scoring must remain deterministic and test-covered. Gameplay uses the synchronous fallback in `src/lib/scoring`; async semantic providers are optional and must fall back cleanly when unavailable.
- Fallback scoring weights are whole text `0.25`, content words `0.35`, chunks `0.25`, and length fit `0.15`. Semantic provider weights are whole semantic `0.35`, chunk semantic `0.30`, content-word fuzzy coverage `0.15`, lexical whole fallback `0.10`, and length fit `0.10`.
- Do not bundle browser embedding/model dependencies by default. Optional endpoint providers must require user configuration, no API keys in the repo, and should document privacy/performance tradeoffs. Future local worker/model providers should use the lazy provider seam so loader/model failures fall back without blocking gameplay.
- Avoid exact-match typing-game semantics; Alkotype rewards fast approximate/semantic similarity.
- Prefer Tailwind utilities. Add shared UI components under `src/lib/ui` only when repetition appears.
- Keep Docker static-only: build in Node, serve `/build` from Nginx with SPA fallback.
