---
title: "History Sim v1: Sarajevo 1914 source-faithful character chat"
labels: [ready-for-agent]
---

## Problem Statement

High-school students (15–17) learn the causes of World War I as a fixed story to memorize. They rarely practice thinking like a historian: comparing versions, spotting bias, catching contradictions and myths (e.g. Princip eating a sandwich). AI character chat could make this hands-on, but only if characters stay faithful to sources. A free model (Workers AI) that invents facts would teach the wrong lesson. Before building any game loop, we need to know: can the free model produce credible characters that stay faithful to free sources?

## Solution

A single-page web prototype in pt-br. The player is an investigator from the future who freezes time on a Sarajevo street right after the shots on 28/06/1914. An intro explains the role and that the characters' calm is a fictional license. The player picks one of four characters and chats with each one separately:

- Gavrilo Princip
- Franz von Harrach (on the car's running board)
- Oskar Potiorek (Governor of Bosnia, in the car; changed the route)
- Luigi Albertini (d. 1941) — a chorus voice outside the scene

Each answer streams in, in the character's voice, and shows a collapsible source excerpt. Characters only know their own sources and point of view, refuse in character when sources don't cover a question, never know anything after their temporal cut, and treat second-hand claims with suspicion. A fidelity eval (~30 cases) measures whether the model passes: ≥ 90% judged pass and zero inventions on trap questions.

## User Stories

1. As a student, I want an intro screen that explains I am a time-frozen investigator, so that I understand my role before talking to anyone.
2. As a student, I want the intro to tell me the characters' calm is a fictional license, so that I don't mistake the scene for a realistic portrayal of the moment.
3. As a student, I want to enter an access code once, so that I can use the prototype my teacher shared.
4. As a student, I want a clear message when my access code is wrong, so that I know to ask for the right one.
5. As a student, I want to see the list of four characters with a short description of each, so that I can choose who to question.
6. As a student, I want to open a separate chat per character, so that each conversation stays focused on one point of view.
7. As a student, I want answers to stream in as they are generated, so that the conversation feels alive and I don't stare at a blank screen.
8. As a student, I want every answer to show where it came from in a collapsible source (literal excerpt for free sources, project-written note + reference for copyrighted ones), so that I can check the claim against the source.
9. As a student, I want source excerpts collapsed by default, so that the chat stays readable.
10. As a student, I want to see the source's name and license/origin, so that I learn to judge source quality.
11. As a student, I want a character to say, in character, that they don't know when the sources don't cover my question, so that I learn the limits of evidence.
12. As a student, I want Princip to not know the war will happen, so that I experience the moment as people lived it.
13. As a student, I want Albertini to know events up to 1941 but nothing later, so that his chorus voice is historically bounded.
14. As a student, I want scene characters to know only up to the instant of the freeze, so that the scene is consistent.
15. As a student, I want to ask about the sandwich myth and get it denied or not confirmed, so that I learn to question popular stories.
16. As a student, I want to tell one character what another one said and see them react with suspicion, so that I learn how second-hand testimony works.
17. As a student, I want each character to only know what I told them about other characters, so that conversations stay isolated like real testimonies.
18. As a student, I want Princip to speak with conviction in his own voice, so that I hear a real perspective rather than a sanitized one.
19. As a student, I want Princip to refuse to detail violence or encourage me, in character, so that the experience stays safe.
20. As a student, I want counterpoints to Princip to come from the other voices, so that I compare perspectives myself.
21. As a student, I want people's names kept in the original (Franz Ferdinand, Sophie Chotek), so that I can search them later.
22. As a student, I want places and organizations in pt-br with the original in parentheses on first mention (Ponte Latina (Latinska ćuprija), Mão Negra (Crna ruka)), so that I understand and can still find the original term.
23. As a student, I want all UI and character answers in pt-br, so that I can follow without a language barrier.
24. As a student, I want my chat history with a character to persist while my session is open, so that I can continue a line of questioning.
25. As a student, I want my identity kept without login, so that I can start right away.
26. As a student, I want a clear in-app message when I hit my daily limit, so that I know when I can come back.
27. As a student, I want a friendly error if the AI fails mid-answer, so that I can retry instead of being stuck.
28. As a student, I want the page to work on a phone, so that I can use it in class.
29. As a teacher, I want one access code to share with my class, so that only my students use the free quota.
30. As a teacher, I want a per-person daily rate limit, so that one student can't burn the whole quota.
31. As a teacher, I want every answer tied to a citable source, so that I can trust what students read.
32. As the developer, I want literal excerpts only from free sources (public domain, Wikipedia CC BY-SA, period documents) and copyrighted works stored only as project-written notes with a reference, so that there are no copyright issues while still using modern scholarship. Character lines are declared as authored by the project.
33. As the developer, I want each corpus chunk tagged with character, source, license and excerpt location, so that answers can cite precisely and retrieval stays per-character.
34. As the developer, I want a character to be dropped from the cast if no citable source covers their account, so that no character is built on invention.
35. As the developer, I want a `ChatProvider` interface for streaming chat, so that I can swap models without touching the character flow.
36. As the developer, I want an `EmbeddingProvider` interface, so that I can swap embedding models (knowing it requires reindexing).
37. As the developer, I want `WorkersAiProvider` as default and `OpenRouterProvider` as paid fallback, selected by environment variable, so that I can compare models and survive quota exhaustion.
38. As the developer, I want all model traffic through AI Gateway, so that I get logs and caching for free.
39. As the developer, I want one Durable Object per `(playerId, characterId)`, so that histories are isolated by construction.
40. As the developer, I want the character flow to be plain code (retrieve → build prompt → stream answer with source), so that it stays simple without a framework.
41. As the developer, I want the name glossary injected into each character's system prompt, so that naming rules are applied consistently.
42. As the developer, I want a script to index the corpus into Vectorize, so that reindexing after a model swap is one command.
43. As the developer, I want a fidelity eval of ~30 cases across categories `fact`, `unknown`, `myth`, `future`, `second-hand`, `safety`, so that I can answer the v1 question with numbers.
44. As the developer, I want each eval case to have `id`, `character`, `category`, `question`, `expected`, `source`, so that cases are reviewable and traceable.
45. As the developer, I want an LLM judge with a rubric returning `pass`/`fail` plus short justification, run via `ChatProvider`, so that I can swap the judge model too.
46. As the developer, I want the eval to report the pass rate and list any invention on trap questions, so that the approval criterion (≥ 90%, zero inventions) is checked automatically.
47. As the developer, I want the eval to hit the same Worker entry point the UI uses, so that it tests the real path, not a copy.
48. As the developer, I want to run the eval against either provider, so that I can compare Workers AI and OpenRouter.
49. As the developer, I want the whole thing to fit the Cloudflare free plan, so that the prototype costs nothing to run.

## Implementation Decisions

- **Hosting:** Cloudflare free plan. Workers (HTTP API + WebSocket), Durable Objects, Workers AI (chat + embeddings), Vectorize, AI Gateway.
- **Modules:**
  - **Worker entry** — routes HTTP and WebSocket, checks access code, applies daily rate limit per `playerId`, forwards to the right Durable Object.
  - **Character session (Durable Object)** — keyed by `(playerId, characterId)`. Holds that conversation's history only. Runs the character turn. No cross-session memory.
  - **Character turn** — plain function: retrieve chunks from Vectorize filtered by `characterId` → build prompt (persona, temporal cut, fidelity rules, glossary, retrieved chunks, history) → stream answer → emit source(s) used. No LangGraph.
  - **Character definitions** — data per character: id, display name, short description, persona/voice notes, temporal cut, safety notes (Princip), which sources belong to them.
  - **Glossary** — the CONTEXT.md table as data, rendered into every system prompt.
  - **Providers (Adapter + Strategy):** `ChatProvider` (streaming chat) and `EmbeddingProvider` (vectors). Adapters `WorkersAiProvider` (default) and `OpenRouterProvider` (fallback). Chosen by env var. Both go through AI Gateway.
  - **Corpus + indexer** — chunks tagged (`characterId`, source title, license, location, `kind`: `excerpt` for free sources, `note` for project-written summaries of copyrighted works). A script embeds and upserts into Vectorize. Changing `EmbeddingProvider` means re-running it.
  - **Frontend** — single page: intro, access code entry, character list, per-character chat, collapsible source. `playerId` generated and stored in `localStorage`. pt-br copy.
  - **Fidelity eval** — case file + runner + LLM judge (via `ChatProvider`). Talks to the Worker entry like the UI does.
- **Stream contract (WebSocket):** the server sends answer text in chunks, then the source(s) for that answer, then an end marker; errors (rate limit, provider failure, bad access code) are explicit message types so the UI can show pt-br messages.
- **Fidelity rules enforced in the prompt:** no coverage → refuse in character; temporal cut (scene characters until the freeze shortly before 11:00 on 28/06/1914, Albertini until 1941); Princip convinced but no violent detail and no encouragement; second-hand info treated with suspicion; characters only know their own point of view.
- **Cast gate:** a character stays only if a free source carries their own account. Harrach passed (trial protocol in Pharos 1918, pp. 158–159). Lojka failed (no free first-person account) and was replaced by Potiorek (trial testimony in Pharos 1918, pp. 155–158). The cast is data, so swapping one is a data change.
- **Access:** single shared access code (secret) + daily per-`playerId` rate limit. Exact limit set after checking free-plan quotas.
- **Verified facts** (details in CONTEXT.md): shots shortly before 11:00, no exact minute; AI Gateway supports OpenRouter; sandwich myth has no period source. Free plan: 10,000 Workers AI neurons/day per account (~70 answers/day on Llama 3.3 70B, ~200 on 8B), shared with the eval. Embeddings must be multilingual (`@cf/baai/bge-m3`); `bge-*-en` models are English-only.

## Testing Decisions

- **One seam: the Worker entry point.** Tests drive the Worker through its real HTTP/WebSocket interface, running in `@cloudflare/vitest-pool-workers` (real Durable Objects and bindings in Miniflare). No tests reach into internal functions.
- **Fakes at the provider boundary only.** Tests inject fake `ChatProvider`/`EmbeddingProvider` (and a fake/in-memory retrieval index) through env, so behavior is deterministic. This is the only substitution point.
- **What a good test looks like:** it sends what a real client sends and asserts what a real client sees — streamed chunks, source payload, end marker, error messages, history continuity. It never asserts prompt strings or internal call order, except where the fake provider records the retrieved chunks to prove per-character filtering.
- **Behaviors to cover at the seam:**
  - Wrong/missing access code is rejected.
  - Daily rate limit blocks after N messages for one `playerId` and not for another.
  - Answer streams in chunks and ends with source(s) and an end marker.
  - History persists within `(playerId, characterId)` and is isolated across characters and across players.
  - Retrieval only returns chunks from the chosen character's sources.
  - Provider failure yields an explicit error message, not a hung stream.
  - Provider selection by env var picks the right adapter.
- **Fidelity eval uses the same seam** with real providers. It is not a unit test: run on demand, not in CI, since it costs quota and is non-deterministic. Output: pass rate, failures with judge justification, explicit list of trap-question inventions.
- **Prior art:** none in this repo yet (no code). Follow Cloudflare's `vitest-pool-workers` patterns for Durable Object and WebSocket tests.

## Out of Scope

- Investigator's notebook (save clues, mark contradictions, scored conclusion).
- Character-to-character confrontation mode.
- Invented street character.
- Cross-session or long-term memory.
- Navigable map (Phaser), voice (STT/TTS), more scenes (trial, Theresienstadt).
- Login/accounts.
- Living historians as characters (never).
- Literal excerpts from copyrighted works in the corpus or UI.
- Measuring engagement or building a commercial demo.

## Further Notes

- The v1 question is only fidelity. Engagement comes later; resist adding game loop features.
- Architecture reference: the PhiloAgents series (transcripts in the repo), minus LangGraph and long-term memory.
- Converting the backlog into issues is a separate task (`to-issues`).
- No issue tracker is configured yet (no git remote, no `/setup-matt-pocock-skills`). This spec lives as a local file with the `ready-for-agent` label in frontmatter until it can be published as an issue.
