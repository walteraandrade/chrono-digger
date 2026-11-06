import { describe, expect, it } from "vitest";
import { newPlayerId, openChat } from "../client";
import {
  BAD_JSON_TRIGGER,
  BAD_STATUS_TRIGGER,
  HUNG_STREAM_TRIGGER,
  SPLIT_SSE_TRIGGER,
  STREAM_ERROR_TRIGGER,
} from "../fakes/openrouter-outbound";

describe("real SSE pipeline", () => {
  it("reassembles events split across reads, with CRLF and no final newline", async () => {
    const chat = await openChat("princip", newPlayerId());
    const turn = await chat.ask(`Onde? ${SPLIT_SSE_TRIGGER}`);
    expect(turn.ended).toBe(true);
    expect(turn.text).toBe("Olá, mundo");
  });

  it.each([
    ["an error event mid-stream", STREAM_ERROR_TRIGGER],
    ["malformed JSON", BAD_JSON_TRIGGER],
    ["a stream that never ends", HUNG_STREAM_TRIGGER],
    ["a non-2xx status", BAD_STATUS_TRIGGER],
  ])("fails the turn on %s, and the session recovers", async (_label, trigger) => {
    const chat = await openChat("princip", newPlayerId());
    const failed = await chat.ask(`Onde? ${trigger}`);
    expect(failed.ended).toBe(false);
    expect(failed.error).toBe("provider_failure");
    const next = await chat.ask("Onde você estava?");
    expect(next.ended).toBe(true);
  });
});
