import { SELF } from "cloudflare:test";
import type { ErrorType, HistoryEntry, ServerMessage } from "../src/contract";
import type { Source } from "../src/turn";
import { TEST_ACCESS_CODE } from "./constants";

export const BASE_URL = "https://chrono.test";

type Closed = { type: "closed"; code: number };
type Inbound = ServerMessage | Closed;

export type Turn = {
  chunks: string[];
  text: string;
  sources: Source[] | undefined;
  ended: boolean;
  error: ErrorType | undefined;
  order: string[];
};

export const newPlayerId = () => crypto.randomUUID();

export const getCharacters = (accessCode?: string) =>
  SELF.fetch(`${BASE_URL}/api/characters`, {
    headers: accessCode === undefined ? {} : { "x-access-code": accessCode },
  });

export const connect = async ({
  characterId,
  playerId,
  accessCode = TEST_ACCESS_CODE,
}: {
  characterId: string;
  playerId: string;
  accessCode?: string | null;
}) => {
  const params = new URLSearchParams({ playerId, ...(accessCode === null ? {} : { accessCode }) });
  const response = await SELF.fetch(`${BASE_URL}/api/characters/${characterId}/session?${params}`, {
    headers: { upgrade: "websocket" },
  });
  const ws = response.webSocket;
  if (!ws) throw new Error(`expected websocket, got ${response.status}`);
  const inbox: Inbound[] = [];
  const waiters: ((message: Inbound) => void)[] = [];
  const push = (message: Inbound) => {
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else inbox.push(message);
  };
  ws.addEventListener("message", (event) => push(JSON.parse(event.data as string) as ServerMessage));
  ws.addEventListener("close", (event) => push({ type: "closed", code: event.code }));
  ws.accept();

  const next = (timeoutMs = 3000) =>
    new Promise<Inbound>((resolve, reject) => {
      const queued = inbox.shift();
      if (queued) return resolve(queued);
      const timer = setTimeout(() => reject(new Error("timed out waiting for a message")), timeoutMs);
      waiters.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });

  const send = (payload: unknown) => ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));

  const readTurn = async (): Promise<Turn> => {
    const turn: Turn = { chunks: [], text: "", sources: undefined, ended: false, error: undefined, order: [] };
    while (true) {
      const message = await next();
      turn.order.push(message.type);
      if (message.type === "chunk") turn.chunks.push(message.text);
      if (message.type === "sources") turn.sources = message.sources;
      if (message.type === "end") turn.ended = true;
      if (message.type === "error") turn.error = message.error;
      if (message.type === "end" || message.type === "error" || message.type === "closed")
        return { ...turn, text: turn.chunks.join("") };
    }
  };

  const ask = (text: string) => {
    send({ type: "ask", text });
    return readTurn();
  };

  const history = async (): Promise<HistoryEntry[]> => {
    const message = await next();
    if (message.type !== "history") throw new Error(`expected history, got ${message.type}`);
    return message.messages;
  };

  return { ws, next, send, ask, readTurn, history, close: () => ws.close(1000) };
};

export const openChat = async (characterId: string, playerId: string) => {
  const chat = await connect({ characterId, playerId });
  const history = await chat.history();
  return { ...chat, initialHistory: history };
};
