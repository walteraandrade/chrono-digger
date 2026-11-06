import { describe, expect, it } from "vitest";
import { sandwichCase } from "../../src/diary/cases";
import { connect, getCharacters, newPlayerId, openChat } from "../client";
import { TEST_ACCESS_CODE, TEST_DAILY_LIMIT } from "../constants";
import { FAIL_TRIGGER, HANG_TRIGGER } from "../fakes/providers";

const PRINCIP_CORNER_WORDS = "stellte mich an der Straßenecke vor einem Kaufladen auf";

const ids = (diary: { lines: { id: string }[] } | undefined) => diary?.lines.map(({ id }) => id);

const readFill = async (chat: Awaited<ReturnType<typeof openChat>>, lineId: string, word: string) => {
  chat.send({ type: "fill", lineId, word });
  return chat.next();
};

describe("character list", () => {
  it("carries the case question, and nothing else from the case", async () => {
    const response = await getCharacters(TEST_ACCESS_CODE);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.caseQuestion).toBe(sandwichCase.question);
    expect(JSON.stringify(body)).not.toMatch(/ninguém|accepted|Pušara/);
  });
});

describe("diary on connect", () => {
  it("arrives after the history, with only the verdict open", async () => {
    const chat = await connect({ characterId: "princip", playerId: newPlayerId() });
    expect((await chat.next()).type).toBe("history");
    const diary = await chat.next();
    expect(diary).toMatchObject({
      type: "diary",
      caseQuestion: sandwichCase.question,
      filled: 0,
      total: 6,
      secretsOpen: 0,
    });
    expect(ids(diary as never)).toEqual(["case-verdict"]);
  });

  it("never sends accepted answers or closed lines", async () => {
    const chat = await openChat("princip", newPlayerId());
    const sent = JSON.stringify(chat.initialDiary);
    expect(sent).not.toMatch(/ninguém|nenhum|accepted|esquina|Pušara|trigger/);
  });

  it("offers the suggested questions", async () => {
    const chat = await openChat("princip", newPlayerId());
    expect(chat.initialDiary.suggestions).toEqual(sandwichCase.suggestions);
  });
});

describe("diary after a turn", () => {
  it("opens lines from a retrieved chunk and sends the diary before the end", async () => {
    const chat = await openChat("princip", newPlayerId());
    const turn = await chat.ask(PRINCIP_CORNER_WORDS);
    expect(turn.order.slice(-3)).toEqual(["sources", "diary", "end"]);
    expect(ids(turn.diary)).toEqual(["princip-corner", "princip-shop", "case-verdict"]);
    expect(turn.diary?.lines[0]).toMatchObject({
      owner: "princip",
      text: "Esperava na ____",
      blank: { filled: false },
      secret: false,
    });
    expect(turn.diary?.lines[0]?.blank).not.toHaveProperty("word");
  });

  it("opens a line from what the player asked that character", async () => {
    const chat = await openChat("albertini", newPlayerId());
    const turn = await chat.ask("Essa história do sanduíche é verdade?");
    expect(ids(turn.diary)).toEqual(["albertini-none", "case-verdict"]);
    expect(turn.diary?.filled).toBe(1);
  });

  it("sends nothing when the turn changes nothing", async () => {
    const chat = await openChat("albertini", newPlayerId());
    expect((await chat.ask("sanduíche")).diary).toBeDefined();
    const second = await chat.ask("sanduíche de novo");
    expect(second.ended).toBe(true);
    expect(second.diary).toBeUndefined();
  });

  it("opens a secret from the answer and adds it to the total", async () => {
    const chat = await openChat("princip", newPlayerId());
    const turn = await chat.ask("Pušara");
    expect(ids(turn.diary)).toEqual(["case-verdict", "princip-stranger"]);
    expect(turn.diary).toMatchObject({ total: 7, secretsOpen: 1, filled: 0 });
    expect(turn.diary?.lines[1]?.secret).toBe(true);
  });

  it("opens nothing on a failed turn", async () => {
    const playerId = newPlayerId();
    const chat = await openChat("albertini", playerId);
    const failed = await chat.ask(`sanduíche ${FAIL_TRIGGER}`);
    expect(failed.error).toBe("provider_failure");
    expect(failed.diary).toBeUndefined();
    const reopened = await openChat("albertini", playerId);
    expect(ids(reopened.initialDiary)).toEqual(["case-verdict"]);
  });
});

describe("filling a blank", () => {
  it("accepts a synonym, sends the result and the new diary, and shows the line's own word", async () => {
    const chat = await openChat("princip", newPlayerId());
    await chat.ask(PRINCIP_CORNER_WORDS);
    expect(await readFill(chat, "princip-shop", " ARMAZEM ")).toEqual({
      type: "fillResult",
      lineId: "princip-shop",
      correct: true,
    });
    const diary = await chat.next();
    expect(diary).toMatchObject({ type: "diary", filled: 1 });
    expect((diary as never as { lines: { blank?: unknown }[] }).lines[1]?.blank).toEqual({
      filled: true,
      word: "loja",
    });
  });

  it("answers a wrong word without changing the diary", async () => {
    const playerId = newPlayerId();
    const chat = await openChat("princip", playerId);
    expect(await readFill(chat, "case-verdict", "talvez")).toEqual({
      type: "fillResult",
      lineId: "case-verdict",
      correct: false,
    });
    const reopened = await openChat("princip", playerId);
    expect(reopened.initialDiary.filled).toBe(0);
  });

  it("does not erase a filled blank on a later wrong word", async () => {
    const playerId = newPlayerId();
    const chat = await openChat("princip", playerId);
    await readFill(chat, "case-verdict", "ninguém");
    await chat.next();
    expect(await readFill(chat, "case-verdict", "talvez")).toMatchObject({ correct: false });
    const reopened = await openChat("princip", playerId);
    expect(reopened.initialDiary.lines[0]?.blank).toEqual({ filled: true, word: "ninguém" });
  });

  it.each([
    ["a closed line", "princip-corner", "esquina"],
    ["an unknown line", "nope", "esquina"],
    ["a closed secret", "princip-stranger", "Pušara"],
  ])("rejects %s", async (_label, lineId, word) => {
    const chat = await openChat("princip", newPlayerId());
    expect(await readFill(chat, lineId, word)).toMatchObject({ type: "error", error: "bad_request" });
  });

  it("rejects a line without a blank", async () => {
    const chat = await openChat("albertini", newPlayerId());
    await chat.ask("sanduíche");
    expect(await readFill(chat, "albertini-none", "x")).toMatchObject({ type: "error", error: "bad_request" });
  });

  it.each([
    ["no line id", { type: "fill", word: "x" }],
    ["an empty word", { type: "fill", lineId: "case-verdict", word: "  " }],
    ["a word that is too long", { type: "fill", lineId: "case-verdict", word: "x".repeat(65) }],
  ])("rejects a message with %s", async (_label, payload) => {
    const chat = await openChat("princip", newPlayerId());
    chat.send(payload);
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_request" });
  });

  it("does not spend the daily limit", async () => {
    const chat = await openChat("princip", newPlayerId());
    for (const index of Array.from({ length: TEST_DAILY_LIMIT + 2 }, (_, i) => i))
      expect(await readFill(chat, "case-verdict", `errado${index}`)).toMatchObject({ correct: false });
    expect((await chat.ask("Ainda posso perguntar?")).ended).toBe(true);
  });

  it("works while an answer is streaming", async () => {
    const chat = await openChat("harrach", newPlayerId());
    chat.send({ type: "ask", text: `Pergunta ${HANG_TRIGGER}` });
    chat.send({ type: "fill", lineId: "case-verdict", word: "talvez" });
    const types = [];
    while (true) {
      const message = await chat.next();
      types.push(message.type);
      if (message.type === "error") break;
    }
    expect(types).toContain("fillResult");
  });
});

describe("diary scope", () => {
  it("is shared across a player's characters", async () => {
    const playerId = newPlayerId();
    const princip = await openChat("princip", playerId);
    await readFill(princip, "case-verdict", "ninguém");
    const harrach = await openChat("harrach", playerId);
    expect(harrach.initialDiary.filled).toBe(1);
  });

  it("is isolated across players", async () => {
    const princip = await openChat("princip", newPlayerId());
    await readFill(princip, "case-verdict", "ninguém");
    const other = await openChat("princip", newPlayerId());
    expect(other.initialDiary.filled).toBe(0);
  });
});
