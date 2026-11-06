import type { DiaryView } from "./diary/rules";
import type { Source } from "./turn";

export const PROTOCOL_VERSION = 1;

export const MAX_QUESTION_LENGTH = 1000;
export const MAX_FILL_WORD_LENGTH = 64;

export type ErrorType =
  | "bad_access_code"
  | "rate_limited"
  | "global_rate_limited"
  | "provider_failure"
  | "unknown_character"
  | "bad_request"
  | "busy"
  | "diary_failure";

export type HistoryEntry = { role: "user" | "assistant"; text: string; sources: Source[] };

export type ServerMessage =
  | { type: "history"; messages: HistoryEntry[] }
  | { type: "chunk"; text: string }
  | { type: "sources"; sources: Source[] }
  | { type: "end" }
  | ({ type: "diary" } & DiaryView)
  | { type: "fillResult"; lineId: string; correct: boolean }
  | { type: "error"; error: ErrorType; message: string };

export type ClientMessage = { type: "ask"; text: string } | { type: "fill"; lineId: string; word: string };

export const CLOSE_CODES: Partial<Record<ErrorType, number>> = {
  bad_access_code: 4401,
  unknown_character: 4404,
  bad_request: 4400,
};

const ERROR_MESSAGES: Record<ErrorType, string> = {
  bad_access_code: "Invalid or missing access code.",
  rate_limited: "Daily message limit reached for this player.",
  global_rate_limited: "Daily message limit reached for the whole deployment.",
  provider_failure: "The AI provider failed to answer or timed out.",
  unknown_character: "Unknown character.",
  bad_request: "Malformed request.",
  busy: "An answer is still streaming for this conversation.",
  diary_failure: "The diary could not check this word.",
};

export const errorMessage = (error: ErrorType): ServerMessage => ({
  type: "error",
  error,
  message: ERROR_MESSAGES[error],
});

const trimmedText = (value: unknown, maxLength: number) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= maxLength ? text : undefined;
};

const toClientMessage = (value: Record<string, unknown>): ClientMessage | undefined => {
  if (value.type === "ask") {
    const text = trimmedText(value.text, MAX_QUESTION_LENGTH);
    return text ? { type: "ask", text } : undefined;
  }
  if (value.type === "fill") {
    const word = trimmedText(value.word, MAX_FILL_WORD_LENGTH);
    return word && typeof value.lineId === "string" && value.lineId
      ? { type: "fill", lineId: value.lineId, word }
      : undefined;
  }
  return undefined;
};

export const parseClientMessage = (raw: string | ArrayBuffer): ClientMessage | undefined => {
  if (typeof raw !== "string") return undefined;
  try {
    return toClientMessage(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return undefined;
  }
};
