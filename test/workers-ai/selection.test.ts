import { describe, expect, it } from "vitest";
import { DEFAULT_WORKERS_AI_CHAT_MODEL } from "../../src/providers/workers-ai";
import { newPlayerId, openChat } from "../client";
import { FAKE_GATEWAY_ID } from "../fakes/openrouter-outbound";

describe("provider selection: no provider env vars", () => {
  it("defaults to the Workers AI adapter through AI Gateway", async () => {
    const chat = await openChat("harrach", newPlayerId());
    const turn = await chat.ask("O que o arquiduque disse?");
    expect(turn.ended).toBe(true);
    expect(turn.text).toBe(`[workers-ai ${DEFAULT_WORKERS_AI_CHAT_MODEL} gateway=${FAKE_GATEWAY_ID}]`);
    expect(turn.sources?.every((source) => source.id.startsWith("harrach-"))).toBe(true);
  });
});
