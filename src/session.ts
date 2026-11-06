import { DurableObject } from "cloudflare:workers";
import * as Effect from "effect/Effect";
import { type Character, findCharacter } from "./characters";
import { type ErrorType, type HistoryEntry, type ServerMessage, errorMessage, parseClientMessage } from "./contract";
import type { CompletedTurn } from "./diary/rules";
import type { Env } from "./env";
import type { HistoryMessage } from "./prompt";
import { type ProviderRegistry, selectProviders } from "./providers/registry";
import { type QuotaGrant, consumeQuota } from "./quota";
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
      await this.sendDiary(server, playerId);
      return new Response(null, { status: 101, webSocket: client });
    }

    private diary(playerId: string) {
      return this.env.PLAYER_DIARY.getByName(playerId);
    }

    private async sendDiary(ws: WebSocket, playerId: string) {
      try {
        send(ws, { type: "diary", ...(await this.diary(playerId).view()) });
      } catch (error) {
        console.error("diary read failed", { error: String(error) });
      }
    }

    private async recordInDiary(ws: WebSocket, playerId: string, turn: CompletedTurn) {
      try {
        const view = await this.diary(playerId).recordTurn(turn);
        if (view) send(ws, { type: "diary", ...view });
      } catch (error) {
        console.error("diary update failed", { characterId: turn.characterId, error: String(error) });
      }
    }

    private async fill(ws: WebSocket, lineId: string, word: string) {
      const { playerId } = ws.deserializeAttachment() as Attachment;
      try {
        const outcome = await this.diary(playerId).fill(lineId, word);
        if (outcome.kind === "unavailable") return sendError(ws, "bad_request");
        send(ws, { type: "fillResult", lineId, correct: outcome.correct });
        if (outcome.diary) send(ws, { type: "diary", ...outcome.diary });
      } catch (error) {
        console.error("diary fill failed", { lineId, error: String(error) });
        sendError(ws, "diary_failure");
      }
    }

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
      const message = parseClientMessage(raw);
      if (!message) return sendError(ws, "bad_request");
      if (message.type === "fill") return this.fill(ws, message.lineId, message.word);
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
      const completed = await this.runTurn(ws, character, question, quota);
      if (!completed) return;
      await this.recordInDiary(ws, playerId, {
        characterId,
        question,
        answer: completed.answer,
        chunkIds: completed.sources.map(({ id }) => id),
      });
      send(ws, { type: "end" });
    }

    private async runTurn(
      ws: WebSocket,
      character: Character,
      question: string,
      quota: Extract<QuotaGrant, { allowed: true }>,
    ) {
      const characterId = character.id;
      try {
        const history: HistoryMessage[] = this.readHistory().map(({ role, text }) => ({
          role,
          content: text,
        }));
        const { answer, sources } = await Effect.runPromise(
          selectProviders(registry, this.env).pipe(
            Effect.flatMap((providers) =>
              runCharacterTurn({
                character,
                question,
                history,
                providers,
                minScore: parseMinSourceScore(this.env.MIN_SOURCE_SCORE),
                timeoutMs: parseTurnTimeoutMs(this.env.TURN_TIMEOUT_MS),
                onChunk: (text) => send(ws, { type: "chunk", text }),
              }),
            ),
          ),
        );
        this.appendTurn(question, answer, sources);
        send(ws, { type: "sources", sources });
        return { answer, sources };
      } catch (error) {
        console.error("character turn failed", { characterId, error: String(error) });
        await quota.refund().catch((refundError: unknown) =>
          console.error("quota refund failed", { characterId, error: String(refundError) }),
        );
        sendError(ws, "provider_failure");
        return undefined;
      }
    }

    async webSocketClose(ws: WebSocket, code: number) {
      attempt(() => ws.close(code === 1005 || code === 1006 ? 1000 : code));
    }
  };

export type CharacterSessionClass = ReturnType<typeof createCharacterSession>;
