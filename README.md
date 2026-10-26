# chrono-digger

History Sim v1: a pt-br single page where students question source-grounded AI characters on a Sarajevo street, 28 June 1914. Cloudflare Worker + Durable Objects + Workers AI + Vectorize + AI Gateway. See `CONTEXT.md`, `docs/spec-v1.md` and `docs/ws-contract.md`.

## Layout

- `src/index.ts` — Worker entry (exports `CharacterSession`, `PlayerQuota`, `GlobalQuota`)
- `src/worker.ts` — HTTP/WebSocket routing, access code
- `src/session.ts` — `CharacterSession` Durable Object (history per `(playerId, characterId)`, hibernatable WebSockets)
- `src/quota.ts` — `PlayerQuota` and `GlobalQuota` Durable Objects (daily limits per `playerId` and for the whole deployment, UTC day; failed turns are refunded)
- `src/turn.ts`, `src/prompt.ts` — character turn: retrieve → build prompt → stream → sources
- `src/characters.ts`, `src/glossary.ts` — data
- `src/providers/` — `ChatProvider` / `EmbeddingProvider` / `RetrievalIndex`, adapters `workers-ai`, `openrouter`, `vectorize`
- `public/` — static frontend served through Workers Assets
- `scripts/index-corpus.ts` — embeds `corpus/*.json` and upserts into Vectorize
- `test/` — tests through the Worker entry only; fakes injected via env at the provider boundary

## Setup

```sh
pnpm install
```

Cloudflare resources (one time, not automated):

```sh
pnpm exec wrangler vectorize create chrono-digger-corpus --dimensions=1024 --metric=cosine
pnpm exec wrangler vectorize create-metadata-index chrono-digger-corpus --propertyName=characterId --type=string
```

Create an AI Gateway named as `AI_GATEWAY_ID` (default `chrono-digger`) in the dashboard.

## Configuration

| Name | Kind | Notes |
|---|---|---|
| `ACCESS_CODE` | secret | shared class code (`wrangler secret put ACCESS_CODE`) |
| `DAILY_LIMIT` | var | messages per `playerId` per UTC day, default `10` |
| `GLOBAL_DAILY_LIMIT` | var | messages for the whole deployment per UTC day, default `60`. The free plan gives ~70 answers/day on Llama 3.3 70B (10k neurons), shared with the fidelity eval |
| `MIN_SOURCE_SCORE` | var | minimum retrieval score for a passage to be used, default `0.45` (bge-m3 cosine). **Needs calibration** against the real index: run the fidelity eval and adjust so trap questions get no passage and covered questions keep theirs. Changing the embedding model requires recalibrating |
| `TURN_TIMEOUT_MS` | var | deadline for the whole turn (embed, query, chat start, stream), default `45000`; on timeout the turn fails with `provider_failure` |
| `CHAT_PROVIDER` | var | `workers-ai` (default) or `openrouter` |
| `EMBEDDING_PROVIDER` | var | `workers-ai` (default) or `openrouter`; changing it requires reindexing |
| `RETRIEVAL_INDEX` | var | `vectorize` (default) |
| `AI_GATEWAY_ID` | var | AI Gateway id used by both adapters |
| `CLOUDFLARE_ACCOUNT_ID` | var | required for `openrouter` (gateway URL) |
| `OPENROUTER_API_KEY` | secret | required for `openrouter` |
| `WORKERS_AI_CHAT_MODEL` / `WORKERS_AI_EMBEDDING_MODEL` | var | defaults `@cf/meta/llama-3.3-70b-instruct-fp8-fast` / `@cf/baai/bge-m3` |
| `OPENROUTER_CHAT_MODEL` / `OPENROUTER_EMBEDDING_MODEL` | var | defaults `meta-llama/llama-3.3-70b-instruct` / `baai/bge-m3` |

Bindings (`wrangler.jsonc`): `AI`, `VECTORIZE`, `CHARACTER_SESSION`, `PLAYER_QUOTA`, `GLOBAL_QUOTA` (SQLite-backed Durable Objects), `ASSETS`.

For local dev put secrets in `.dev.vars` (`ACCESS_CODE=...`). Workers AI and Vectorize have no local emulation; they need a Cloudflare login.

## Commands

```sh
pnpm dev          # wrangler dev
pnpm typecheck    # tsc for worker/tests and for node scripts
pnpm test         # vitest + @cloudflare/vitest-pool-workers
pnpm index:check  # validate corpus/*.json, upload nothing
pnpm index:corpus # embed and upsert corpus/*.json into Vectorize
```

`index:corpus` reads `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Workers AI + Vectorize edit), `AI_GATEWAY_ID`, `VECTORIZE_INDEX` (default `chrono-digger-corpus`), `EMBEDDING_PROVIDER` and, for OpenRouter, `OPENROUTER_API_KEY`. Upserts are idempotent by chunk id, so rerunning reindexes.

## Tests

Projects in `vitest.config.ts`:

- `seam` — fake chat/embedding providers and an in-memory Vectorize-shaped index (selected by env: `CHAT_PROVIDER=fake`, ...; registered in `test/worker.ts`)
- `global-quota` — same fakes, with a tiny `GLOBAL_DAILY_LIMIT` (own project so other tests do not share the counter)
- `openrouter` — real OpenRouter adapter, outbound HTTP answered by a fake gateway
- `workers-ai` — no provider vars (defaults), real Workers AI adapter over a fake `AI` service binding
- `corpus` — Node; validates every chunk in `corpus/*.json`
