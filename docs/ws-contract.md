# Frontend ↔ backend contract (v1)

The frontend talks to the backend only through these two endpoints. The backend holds no layout: no ordering, no screen state. Character definitions are data; a future map can add fields (position, sprite) without breaking clients.

## 1. Read character definitions

`GET /api/characters`

Header: `x-access-code: <shared access code>`

- `200`:
  ```json
  { "caseQuestion": "Princip estava comendo um sanduíche?", "characters": [{ "id": "princip", "displayName": "Gavrilo Princip", "description": "..." }] }
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

Then the player's diary, shared across all characters of that `playerId`:

```json
{
  "type": "diary",
  "caseQuestion": "Princip estava comendo um sanduíche?",
  "lines": [
    { "id": "princip-shop", "owner": "princip", "text": "Estava diante de uma ____", "blank": { "filled": true, "word": "loja" }, "secret": false },
    { "id": "albertini-none", "owner": "albertini", "text": "...", "secret": false }
  ],
  "filled": 2,
  "total": 6,
  "secretsOpen": 0,
  "suggestions": [{ "characterId": "princip", "text": "Onde você estava quando o carro parou?" }]
}
```

- Closed lines are not sent. `total` counts every common line plus the secrets already open, so a closed secret stays invisible.
- `owner` is a character id or `case`. A line without `blank` is done as soon as it opens.
- `word` appears only after a right answer. It is the line's own word, so the sentence stays grammatical: a player who types the synonym "armazém" sees "loja".
- `closing` (`text`, `references`) appears only when `filled` equals `total`.
- `suggestions` is static. Show a suggestion on its character's chat and hide it once its `text` is in that conversation's history; failed turns are not stored, so a failed suggestion stays. Clicking sends a normal `ask`.
- If the diary cannot be read, this message is skipped and the chat keeps working.

### Client → server

```json
{ "type": "ask", "text": "Onde você estava quando o carro passou de novo?" }
```

`text` is trimmed and must be 1–1000 characters. Send one `ask` at a time; wait for `end` or `error` before the next.

```json
{ "type": "fill", "lineId": "princip-shop", "word": "armazém" }
```

`word` is trimmed and must be 1–64 characters. A `fill` spends no daily limit, can be retried freely and may be sent while an answer streams, so its replies can arrive between `chunk` messages.

### Server → client, per `fill`

1. One `{ "type": "fillResult", "lineId": "...", "correct": true }`.
2. One `diary` message, only if a blank was newly filled.

A `fill` for a closed, unknown or blank-less line gets `bad_request`, as does a malformed message. A later wrong word never erases a filled blank.

### Server → client, per `ask`

A successful turn is, in order:

1. zero or more `{ "type": "chunk", "text": "..." }` — answer text, to be concatenated;
2. exactly one `{ "type": "sources", "sources": [Source, ...] }` — the passages retrieved for this answer. Matches scoring below `MIN_SOURCE_SCORE` are dropped, so the list may be empty when nothing in the character's sources covers the question; the character is then told to say it does not know, and the UI shows a "no passage" note;
3. one `diary` message, only if the turn opened a line;
4. exactly one `{ "type": "end" }`.

A diary failure after a good answer is logged and does not fail the turn: the answer stands and the `diary` message is skipped.

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
| `diary_failure` | a `fill` could not be checked | "Não deu para conferir a palavra. Tente de novo." |

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
