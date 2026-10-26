# Frontend ↔ backend contract (v1)

The frontend talks to the backend only through these two endpoints. The backend holds no layout: no ordering, no screen state. Character definitions are data; a future map can add fields (position, sprite) without breaking clients.

## 1. Read character definitions

`GET /api/characters`

Header: `x-access-code: <shared access code>`

- `200`:
  ```json
  { "characters": [{ "id": "princip", "displayName": "Gavrilo Princip", "description": "..." }] }
  ```
  Array order carries no meaning. Clients must ignore unknown fields.
- `401`: `{ "type": "error", "error": "bad_access_code", "message": "..." }`

A session path whose `characterId` segment is not valid percent-encoding answers HTTP `400` with `{ "type": "error", "error": "bad_request", ... }`.

## 2. Character session (WebSocket)

`GET /api/characters/{characterId}/session?playerId={playerId}&accessCode={code}` with `Upgrade: websocket`.

- `playerId`: client-generated id, `[A-Za-z0-9_-]{8,64}` (the web page uses `crypto.randomUUID()` stored in `localStorage`).
- One conversation per `(playerId, characterId)`. History is kept server-side and is isolated per pair.
- Without the `Upgrade` header the server answers HTTP `426`.
- The access code travels in the query string because browsers cannot set headers on WebSocket requests. It is a shared class code, not a personal secret.

### Connection-level errors

If the access code, character or player id is invalid, the server accepts the socket, sends one `error` message and closes it:

| `error` | close code |
|---|---|
| `bad_access_code` | 4401 |
| `unknown_character` | 4404 |
| `bad_request` | 4400 |

### On connect

The server first sends the stored history (empty for a new conversation):

```json
{ "type": "history", "messages": [
  { "role": "user", "text": "...", "sources": [] },
  { "role": "assistant", "text": "...", "sources": [Source, ...] }
] }
```

### Client → server

```json
{ "type": "ask", "text": "Onde você estava quando o carro passou de novo?" }
```

`text` is trimmed and must be 1–1000 characters. Send one `ask` at a time; wait for `end` or `error` before the next.

### Server → client, per `ask`

A successful turn is, in order:

1. zero or more `{ "type": "chunk", "text": "..." }` — answer text, to be concatenated;
2. exactly one `{ "type": "sources", "sources": [Source, ...] }` — the passages retrieved for this answer. Matches scoring below `MIN_SOURCE_SCORE` are dropped, so the list may be empty when nothing in the character's sources covers the question; the character is then told to say it does not know, and the UI shows a "no passage" note;
3. exactly one `{ "type": "end" }`.

A failed turn ends with one `error` message instead of `sources` + `end`. Chunks may already have been sent before a `provider_failure`; the client must discard the partial text and mark the question as failed. Failed turns are not stored in the history and do not count against either daily limit (the quota is refunded). The socket stays open after a turn error.

Messages belong to the socket that carried the `ask`. A client that reconnects or switches character must ignore anything still arriving on the old socket.

```json
{ "type": "error", "error": "rate_limited", "message": "..." }
```

| `error` | meaning | suggested pt-br UI copy |
|---|---|---|
| `rate_limited` | daily per-`playerId` limit (`DAILY_LIMIT`, default 10, UTC day) reached; nothing was generated | "Você chegou ao limite de perguntas de hoje." |
| `global_rate_limited` | daily limit for the whole deployment (`GLOBAL_DAILY_LIMIT`, default 60, UTC day) reached; nothing was generated | "A turma usou toda a cota de hoje. Voltem amanhã!" |
| `provider_failure` | embedding, retrieval or chat provider failed, the stream stalled for 30 s, or the whole turn exceeded `TURN_TIMEOUT_MS` (default 45 s) | "A resposta falhou. Tente de novo." |
| `bad_request` | malformed message or text out of bounds | "Não entendi a pergunta." |
| `busy` | an answer is still streaming on this conversation | "Espere a resposta anterior terminar." |

`message` is an English diagnostic; clients map `error` to their own copy.

### Source

```json
{
  "id": "pharos-1918-potiorek-03",
  "sourceTitle": "Der Prozeß gegen die Attentäter von Sarajewo",
  "author": "Pharos (ed.)",
  "year": 1918,
  "license": "public-domain",
  "location": "p. 157",
  "url": "https://archive.org/details/...",
  "language": "de",
  "passage": "..."
}
```

`year` is a number or a string. `url` may be empty. `license` is `public-domain` or `copyright-short-quote`. Clients link `url` only when it is `https:`.
