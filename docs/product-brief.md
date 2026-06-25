# Alkotype product brief

## One-line idea

Alkotype is Monkeytype for approximate drunk typing: players race to retype a prompt, but the app accepts typos and scores whether the result is still recognizably close to the original meaning.

## Product promise

A player opens a static web app, chooses a prompt, starts typing, and receives an immediate score that combines speed and similarity. The game should feel funny and forgiving: exact spelling matters less than preserving the idea.

## Non-goals for the MVP

- No accounts, leaderboards, backend, database, Stripe, custom domain, or deployment automation.
- No server-side embeddings in the first static build.
- No exact Monkeytype clone mechanics that punish every character mismatch.

## Scoring model direction

The target scoring model should combine several views of the text:

1. **Whole text / sentence embedding similarity** — captures overall meaning.
2. **Sentence-length chunks** — compare chunks split by original sentence boundaries or approximate 8–12 word windows when punctuation is missing.
3. **Meaningful words** — ignore very short/common words, embed or fuzzy-match content words separately, and average coverage.
4. **Length fit** — discourage writing a very short paraphrase that preserves only one concept.
5. **Speed multiplier** — report raw WPM and effective WPM (`WPM × similarity`).

Because the app is static, semantic scoring should either run fully in-browser or be optional behind a user-configured endpoint. A deterministic fuzzy scorer should remain as fallback.

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
