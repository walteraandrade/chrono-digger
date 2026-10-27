import type { Source } from "./turn";

export const PROTOCOL_VERSION = 1;

export const MAX_QUESTION_LENGTH = 1000;

export type ErrorType =
  | "bad_access_code"
  | "rate_limited"
  | "global_rate_limited"
  | "provider_failure"
  | "unknown_character"
  | "bad_request"
  | "busy";

export type HistoryEntry = { role: "user" | "assistant"; text: string; sources: Source[] };

export type ServerMessage =
  | { type: "history"; messages: HistoryEntry[] }
  | { type: "chunk"; text: string }
  | { type: "sources"; sources: Source[] }
  | { type: "end" }
  | { type: "error"; error: ErrorType; message: string };

export type ClientMessage = { type: "ask"; text: string };

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
};

export const errorMessage = (error: ErrorType): ServerMessage => ({
  type: "error",
  error,
  message: ERROR_MESSAGES[error],
});

export const parseClientMessage = (raw: string | ArrayBuffer): ClientMessage | undefined => {
  if (typeof raw !== "string") return undefined;
  try {
    const value = JSON.parse(raw) as Partial<ClientMessage>;
    const text = typeof value.text === "string" ? value.text.trim() : "";
    return value.type === "ask" && text && text.length <= MAX_QUESTION_LENGTH
      ? { type: "ask", text }
      : undefined;
  } catch {
    return undefined;
  }
};
