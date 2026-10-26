import { describe, expect, it } from "vitest";
import { DEFAULT_OPENROUTER_CHAT_MODEL } from "../../src/providers/openrouter";
import { newPlayerId, openChat } from "../client";

describe("provider selection: CHAT_PROVIDER=openrouter, EMBEDDING_PROVIDER=openrouter", () => {
  it("answers through the OpenRouter adapter via AI Gateway", async () => {
    const chat = await openChat("princip", newPlayerId());
    const turn = await chat.ask("Onde você estava?");
    expect(turn.ended).toBe(true);
    expect(turn.text).toBe(`[openrouter ${DEFAULT_OPENROUTER_CHAT_MODEL} via gateway]`);
    expect(turn.sources?.every((source) => source.id.startsWith("princip-"))).toBe(true);
  });
});
