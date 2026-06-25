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
- Scoring must remain deterministic and test-covered. If embedding-based scoring is added, keep a local fallback path so the app still works as static hosting.
- Avoid exact-match typing-game semantics; Alkotype rewards fast approximate/semantic similarity.
- Prefer Tailwind utilities. Add shared UI components under `src/lib/ui` only when repetition appears.
- Keep Docker static-only: build in Node, serve `/build` from Nginx with SPA fallback.
