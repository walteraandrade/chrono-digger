import { describe, expect, it } from "vitest";
import { newPlayerId, openChat } from "../client";
import { TEST_DAILY_LIMIT } from "../constants";
import { FAIL_TRIGGER, HANG_EMBED_TRIGGER, HANG_TRIGGER } from "../fakes/providers";

describe("conversation stream", () => {
  it("streams an answer in chunks, then sources, then the end marker", async () => {
    const chat = await openChat("princip", newPlayerId());
    expect(chat.initialHistory).toEqual([]);

    const turn = await chat.ask("Ciganovic sagte Bomben geben?");

    expect(turn.chunks.length).toBeGreaterThan(1);
    expect(turn.text).toBe("Resposta 1: Ciganovic sagte Bomben geben?");
    expect(turn.order.slice(-2)).toEqual(["sources", "end"]);
    expect(turn.order.slice(0, -2).every((type) => type === "chunk")).toBe(true);
    expect(turn.sources?.length).toBeGreaterThan(0);
    turn.sources?.forEach((source) => {
      expect(source).toMatchObject({
        sourceTitle: expect.any(String),
        location: expect.any(String),
        license: expect.any(String),
        passage: expect.any(String),
      });
    });
  });

  it("rejects malformed client messages without breaking the session", async () => {
    const chat = await openChat("princip", newPlayerId());
    chat.send("not json");
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_request" });
    chat.send({ type: "ask", text: "   " });
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_request" });
    expect((await chat.ask("Ainda está aí?")).ended).toBe(true);
  });
});

describe("history", () => {
  it("persists within the same player and character", async () => {
    const playerId = newPlayerId();
    const first = await openChat("harrach", playerId);
    await first.ask("Schuß gehört, bevor die Bombe fiel?");
    const second = await first.ask("Segunda pergunta");
    expect(second.text).toBe("Resposta 2: Segunda pergunta");
    first.close();

    const reopened = await openChat("harrach", playerId);
    expect(reopened.initialHistory.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Schuß gehört, bevor die Bombe fiel?" },
      { role: "assistant", text: "Resposta 1: Schuß gehört, bevor die Bombe fiel?" },
      { role: "user", text: "Segunda pergunta" },
      { role: "assistant", text: "Resposta 2: Segunda pergunta" },
    ]);
    expect(reopened.initialHistory[1]?.sources.length).toBeGreaterThan(0);
    expect((await reopened.ask("Terceira pergunta")).text).toBe("Resposta 3: Terceira pergunta");
  });

  it("is isolated across characters and across players", async () => {
    const playerId = newPlayerId();
    const harrach = await openChat("harrach", playerId);
    await harrach.ask("O Potiorek disse que os tiros vieram da esquerda.");

    const potiorek = await openChat("potiorek", playerId);
    expect(potiorek.initialHistory).toEqual([]);
    expect((await potiorek.ask("Oi")).text).toBe("Resposta 1: Oi");

    const otherPlayer = await openChat("harrach", newPlayerId());
    expect(otherPlayer.initialHistory).toEqual([]);
    expect((await otherPlayer.ask("Oi")).text).toBe("Resposta 1: Oi");
  });
});

describe("retrieval", () => {
  it("only returns chunks from the chosen character's sources", async () => {
    const harrachWords = "bevor die Bombe fiel, deutlich einen Schuß gehört";

    const princip = await openChat("princip", newPlayerId());
    const principTurn = await princip.ask(harrachWords);
    expect(principTurn.ended).toBe(true);
    expect(principTurn.sources).toEqual([]);

    const harrach = await openChat("harrach", newPlayerId());
    const harrachTurn = await harrach.ask(harrachWords);
    expect(harrachTurn.sources?.[0]?.id).toBe("harrach-p158");
    expect(harrachTurn.sources?.every((source) => source.id.startsWith("harrach-"))).toBe(true);
  });

  it("drops weak matches, so an unrelated question yields no sources", async () => {
    const princip = await openChat("princip", newPlayerId());
    const turn = await princip.ask("Quem ganhou a Copa do Mundo de 2002?");
    expect(turn.ended).toBe(true);
    expect(turn.sources).toEqual([]);
  });

  it("answers with no sources when the character has no indexed chunks", async () => {
    const albertini = await openChat("albertini", newPlayerId());
    const turn = await albertini.ask("Quem era Ciganović?");
    expect(turn.ended).toBe(true);
    expect(turn.sources).toEqual([]);
  });
});

describe("rate limit", () => {
  it(`blocks one player after ${TEST_DAILY_LIMIT} messages and not another`, async () => {
    const limited = newPlayerId();
    const princip = await openChat("princip", limited);
    const harrach = await openChat("harrach", limited);
    for (const index of Array.from({ length: TEST_DAILY_LIMIT }, (_, i) => i)) {
      const chat = index % 2 === 0 ? princip : harrach;
      expect((await chat.ask(`Pergunta ${index}`)).ended).toBe(true);
    }

    const blocked = await princip.ask("Mais uma");
    expect(blocked.error).toBe("rate_limited");
    expect(blocked.ended).toBe(false);
    expect(blocked.chunks).toEqual([]);
    expect((await harrach.ask("E agora?")).error).toBe("rate_limited");

    const other = await openChat("princip", newPlayerId());
    expect((await other.ask("Mais uma")).ended).toBe(true);
  });
});

describe("provider failure", () => {
  it("yields an explicit error instead of a hung stream, and the session recovers", async () => {
    const playerId = newPlayerId();
    const chat = await openChat("potiorek", playerId);

    const failed = await chat.ask(`Pergunta ${FAIL_TRIGGER}`);
    expect(failed.error).toBe("provider_failure");
    expect(failed.ended).toBe(false);
    expect(failed.sources).toBeUndefined();

    const recovered = await chat.ask("De novo");
    expect(recovered.ended).toBe(true);
    expect(recovered.text).toBe("Resposta 1: De novo");

    const reopened = await openChat("potiorek", playerId);
    expect(reopened.initialHistory.map(({ text }) => text)).toEqual(["De novo", "Resposta 1: De novo"]);
  });

  it.each([
    ["while streaming", HANG_TRIGGER],
    ["while embedding", HANG_EMBED_TRIGGER],
  ])("times out a provider that hangs %s and releases the session", async (_label, trigger) => {
    const chat = await openChat("harrach", newPlayerId());

    const hung = await chat.ask(`Pergunta ${trigger}`);
    expect(hung.error).toBe("provider_failure");
    expect(hung.ended).toBe(false);

    const recovered = await chat.ask("De novo");
    expect(recovered.ended).toBe(true);
    expect(recovered.text).toBe("Resposta 1: De novo");
  });

  it("refunds the daily quota of failed turns", async () => {
    const chat = await openChat("potiorek", newPlayerId());
    expect((await chat.ask(`Pergunta ${FAIL_TRIGGER}`)).error).toBe("provider_failure");
    expect((await chat.ask(`Pergunta ${HANG_TRIGGER}`)).error).toBe("provider_failure");
    for (const index of Array.from({ length: TEST_DAILY_LIMIT }, (_, i) => i))
      expect((await chat.ask(`Pergunta ${index}`)).ended).toBe(true);
    expect((await chat.ask("Mais uma")).error).toBe("rate_limited");
  });
});
