import type { ErrorType, ServerMessage } from "../src/contract.ts";
import type { Source } from "../src/providers/types.ts";

export const DEFAULT_ASK_TIMEOUT_MS = 60_000;
export const MAX_CONSECUTIVE_FAILURES = 3;

export type SocketHandlers = { onMessage: (data: string) => void; onClose: () => void };

export type Socket = { send: (data: string) => void; close: () => void };

export type Connect = (url: string, handlers: SocketHandlers) => Promise<Socket>;

export type Transport = { connect: Connect; baseUrl: string; accessCode: string; timeoutMs?: number };

export type FailureReason = ErrorType | "timeout" | "socket_closed" | "connection_failed";

export type Answer =
  | { status: "answered"; text: string; sources: Source[] }
  | { status: "failed"; error: FailureReason };

export type CaseResult = Answer & { id: string; finishedAt: string };

export type CaseToRun = { id: string; character: string; question: string };

const FATAL_ERRORS: readonly FailureReason[] = [
  "bad_access_code",
  "unknown_character",
  "rate_limited",
  "global_rate_limited",
];

export const sessionUrl = (baseUrl: string, characterId: string, accessCode: string) => {
  const params = new URLSearchParams({ playerId: `eval-${crypto.randomUUID()}`, accessCode });
  return `${baseUrl}/api/characters/${encodeURIComponent(characterId)}/session?${params}`;
};

export const askCharacter = (
  { connect, baseUrl, accessCode, timeoutMs = DEFAULT_ASK_TIMEOUT_MS }: Transport,
  characterId: string,
  question: string,
): Promise<Answer> =>
  new Promise((resolve) => {
    const chunks: string[] = [];
    let sources: Source[] = [];
    let socket: Socket | undefined;
    let settled = false;

    const finish = (answer: Answer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.close();
      resolve(answer);
    };

    const timer = setTimeout(() => finish({ status: "failed", error: "timeout" }), timeoutMs);

    const onMessage = (data: string) => {
      if (settled) return;
      const message = JSON.parse(data) as ServerMessage;
      if (message.type === "history") socket?.send(JSON.stringify({ type: "ask", text: question }));
      if (message.type === "chunk") chunks.push(message.text);
      if (message.type === "sources") sources = message.sources;
      if (message.type === "end") finish({ status: "answered", text: chunks.join(""), sources });
      if (message.type === "error") finish({ status: "failed", error: message.error });
    };

    connect(sessionUrl(baseUrl, characterId, accessCode), {
      onMessage,
      onClose: () => finish({ status: "failed", error: "socket_closed" }),
    })
      .then((opened) => {
        socket = opened;
        if (settled) opened.close();
      })
      .catch(() => finish({ status: "failed", error: "connection_failed" }));
  });

export type RunOptions = {
  cases: readonly CaseToRun[];
  previous: Readonly<Record<string, CaseResult>>;
  ask: (evalCase: CaseToRun) => Promise<Answer>;
  onResult: (results: Record<string, CaseResult>, evalCase: CaseToRun) => Promise<void> | void;
  now?: () => Date;
};

export type RunOutcome = { results: Record<string, CaseResult>; stopped?: string };

export const runCases = async ({
  cases,
  previous,
  ask,
  onResult,
  now = () => new Date(),
}: RunOptions): Promise<RunOutcome> => {
  const pending = cases.filter((evalCase) => previous[evalCase.id]?.status !== "answered");
  let results = { ...previous };
  let consecutiveFailures = 0;
  for (const evalCase of pending) {
    const answer = await ask(evalCase);
    if (answer.status === "failed" && FATAL_ERRORS.includes(answer.error))
      return { results, stopped: `${evalCase.id}: ${answer.error}` };
    results = { ...results, [evalCase.id]: { ...answer, id: evalCase.id, finishedAt: now().toISOString() } };
    await onResult(results, evalCase);
    consecutiveFailures = answer.status === "failed" ? consecutiveFailures + 1 : 0;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)
      return { results, stopped: `${consecutiveFailures} failures in a row, last: ${evalCase.id}` };
  }
  return { results };
};
