import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BASE_URL, connect, getCharacters, newPlayerId } from "../client";
import { TEST_ACCESS_CODE } from "../constants";

describe("access code", () => {
  it("rejects character reads without or with a wrong access code", async () => {
    for (const code of [undefined, "", "wrong-code"]) {
      const response = await getCharacters(code);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ type: "error", error: "bad_access_code" });
    }
  });

  it("returns character definitions as data with the right access code", async () => {
    const response = await getCharacters(TEST_ACCESS_CODE);
    expect(response.status).toBe(200);
    const { characters } = (await response.json()) as {
      characters: { id: string; displayName: string; description: string }[];
    };
    expect(characters.map((character) => character.id).sort()).toEqual([
      "albertini",
      "harrach",
      "potiorek",
      "princip",
    ]);
    characters.forEach((character) => {
      expect(Object.keys(character).sort()).toEqual(["description", "displayName", "id"]);
      expect(character.displayName).not.toBe("");
      expect(character.description).not.toBe("");
    });
  });

  it.each([
    ["missing", null],
    ["wrong", "wrong-code"],
  ])("rejects a websocket session with a %s access code", async (_label, accessCode) => {
    const chat = await connect({ characterId: "princip", playerId: newPlayerId(), accessCode });
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_access_code" });
    expect(await chat.next()).toEqual({ type: "closed", code: 4401 });
  });

  it("rejects an unknown character", async () => {
    const chat = await connect({ characterId: "lojka", playerId: newPlayerId() });
    expect(await chat.next()).toMatchObject({ type: "error", error: "unknown_character" });
    expect(await chat.next()).toEqual({ type: "closed", code: 4404 });
  });

  it("rejects a malformed player id", async () => {
    const chat = await connect({ characterId: "princip", playerId: "x" });
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_request" });
  });

  it("answers 400 to a malformed percent-encoded character id", async () => {
    const response = await SELF.fetch(
      `${BASE_URL}/api/characters/%E0%A4%A/session?playerId=${newPlayerId()}&accessCode=${TEST_ACCESS_CODE}`,
      { headers: { upgrade: "websocket" } },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ type: "error", error: "bad_request" });
  });

  it("requires a websocket upgrade for sessions", async () => {
    const response = await SELF.fetch(
      `${BASE_URL}/api/characters/princip/session?playerId=${newPlayerId()}&accessCode=${TEST_ACCESS_CODE}`,
    );
    expect(response.status).toBe(426);
  });
});
