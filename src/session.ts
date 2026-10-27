import { DurableObject } from "cloudflare:workers";
import { findCharacter } from "./characters";
import { type ErrorType, type HistoryEntry, type ServerMessage, errorMessage, parseClientMessage } from "./contract";
import type { Env } from "./env";
import type { HistoryMessage } from "./prompt";
import { type ProviderRegistry, selectProviders } from "./providers/registry";
import { consumeQuota } from "./quota";
import { type Source, parseMinSourceScore, parseTurnTimeoutMs, runCharacterTurn } from "./turn";

export const PLAYER_HEADER = "x-player-id";
export const CHARACTER_HEADER = "x-character-id";

type Attachment = { playerId: string; characterId: string };

type Row = { role: "user" | "assistant"; content: string; sources: string };

const attempt = (action: () => void) => {
  try {
    action();
  } catch {
    return;
  }
};

const send = (ws: WebSocket, message: ServerMessage) => attempt(() => ws.send(JSON.stringify(message)));

const sendError = (ws: WebSocket, error: ErrorType) => send(ws, errorMessage(error));

export const createCharacterSession = (registry: ProviderRegistry) =>
  class CharacterSession extends DurableObject<Env> {
    private busy = false;

    constructor(ctx: DurableObjectState, env: Env) {
      super(ctx, env);
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, content TEXT NOT NULL, sources TEXT NOT NULL)",
      );
    }

    private readHistory(): HistoryEntry[] {
      return this.ctx.storage.sql
        .exec<Row>("SELECT role, content, sources FROM messages ORDER BY seq")
        .toArray()
        .map(({ role, content, sources }) => ({
          role,
          text: content,
          sources: JSON.parse(sources) as Source[],
        }));
    }

    private appendTurn(question: string, answer: string, sources: Source[]) {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec(
          "INSERT INTO messages (role, content, sources) VALUES ('user', ?, '[]')",
          question,
        );
        this.ctx.storage.sql.exec(
          "INSERT INTO messages (role, content, sources) VALUES ('assistant', ?, ?)",
          answer,
          JSON.stringify(sources),
        );
      });
    }

    async fetch(request: Request): Promise<Response> {
      const playerId = request.headers.get(PLAYER_HEADER);
      const characterId = request.headers.get(CHARACTER_HEADER);
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket" || !playerId || !characterId)
        return new Response("expected websocket upgrade", { status: 426 });
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId, characterId } satisfies Attachment);
      send(server, { type: "history", messages: this.readHistory() });
      return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
      const message = parseClientMessage(raw);
      if (!message) return sendError(ws, "bad_request");
      if (this.busy) return sendError(ws, "busy");
      this.busy = true;
      try {
        await this.answer(ws, message.text);
      } finally {
        this.busy = false;
      }
    }

    private async answer(ws: WebSocket, question: string) {
      const { playerId, characterId } = ws.deserializeAttachment() as Attachment;
      const character = findCharacter(characterId);
      if (!character) return sendError(ws, "unknown_character");
      const quota = await consumeQuota(this.env, playerId);
      if (!quota.allowed) return sendError(ws, quota.error);
      try {
        const history: HistoryMessage[] = this.readHistory().map(({ role, text }) => ({
          role,
          content: text,
        }));
        const { answer, sources } = await runCharacterTurn({
          character,
          question,
          history,
          providers: selectProviders(registry, this.env),
          minScore: parseMinSourceScore(this.env.MIN_SOURCE_SCORE),
          timeoutMs: parseTurnTimeoutMs(this.env.TURN_TIMEOUT_MS),
          onChunk: (text) => send(ws, { type: "chunk", text }),
        });
        this.appendTurn(question, answer, sources);
        send(ws, { type: "sources", sources });
        send(ws, { type: "end" });
      } catch (error) {
        console.error("character turn failed", { characterId, error: String(error) });
        await quota.refund().catch((refundError: unknown) =>
          console.error("quota refund failed", { characterId, error: String(refundError) }),
        );
        sendError(ws, "provider_failure");
      }
    }

    async webSocketClose(ws: WebSocket, code: number) {
      attempt(() => ws.close(code === 1005 || code === 1006 ? 1000 : code));
    }
  };

export type CharacterSessionClass = ReturnType<typeof createCharacterSession>;
