# Alkotype product brief

## One-line idea

Alkotype is Monkeytype for approximate drunk typing: players race to retype a prompt, but the app accepts typos and scores whether the result is still recognizably close to the original meaning.

## Product promise

A player opens a static web app, chooses a prompt, starts typing, and receives an immediate score that combines speed and similarity. The game should feel funny and forgiving: exact spelling matters less than preserving the idea.

## Non-goals for the MVP

- No accounts, leaderboards, backend, database, Stripe, custom domain, or deployment automation.
- No server-side embeddings in the first static build.
- No exact Monkeytype clone mechanics that punish every character mismatch.

## Scoring model

The implemented static fallback combines several deterministic views of the text:

1. **Whole text typo-tolerant similarity** — weight `0.25`.
2. **Meaningful content-word fuzzy coverage** — weight `0.35`, ignoring very short/common words.
3. **Sentence/source-guided chunks** — weight `0.25`; source text splits on sentence punctuation/newlines when present, otherwise approximate 8–12 word chunks with target 10. Attempts with missing punctuation follow the source shape and compare same-index plus nearby chunks.
4. **Length fit** — weight `0.15`, discouraging very short answers that preserve only one concept.
5. **Speed multiplier** — report raw WPM and effective WPM (`WPM × similarity`).

The async semantic API is provider-ready but optional. With an `EmbeddingProvider`, the scorer embeds only the whole text and chunks, then combines whole semantic cosine similarity (`0.35`), chunk semantic cosine similarity (`0.30`), content-word fuzzy coverage (`0.15`), lexical whole-text fallback similarity (`0.10`), and length fit (`0.10`). It does not embed individual content words in the MVP.

Because the app is static, semantic scoring must either run fully in-browser or use an explicitly configured client-side endpoint. Endpoint scoring can leak prompt/attempt text to that endpoint and adds network latency, so the default game remains offline deterministic fallback. Browser-local models, such as a future `@huggingface/transformers` worker, should plug in through the lazy provider seam and remain deferred because model downloads, startup cost, memory pressure, loader failures, and browser support need separate product and UX work.

## MVP acceptance criteria

- Static SvelteKit app builds to `build/` and can be served by Nginx.
- Player can select a prompt, type an approximate answer, finish/reset, and see time, WPM, similarity, and effective WPM.
- Scoring tolerates typos and rewards content overlap more than exact character matching.
- Scoring logic has unit tests.
- Repository documents local development and Docker static hosting.

## Suggested future modes

- `Classic`: exact-ish prompt retelling with forgiving scoring.
- `Alco`: punctuation and endings are optional; chunking follows approximate original sentence length.
- `Benchmark`: fixed prompt set for comparing scoring algorithm changes.
- `Party`: rotating absurd prompts with a big final score card.
