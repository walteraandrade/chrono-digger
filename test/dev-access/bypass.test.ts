import { describe, expect, it } from "vitest";
import { BASE_URL, connect, getCharacters, newPlayerId } from "../client";

const LOCAL_ORIGINS = ["http://localhost:8787", "http://127.0.0.1:8787", "http://[::1]:8787"];

describe("ACCESS_CODE_DISABLED=true", () => {
  it.each(LOCAL_ORIGINS)("opens character reads on %s without a code", async (origin) => {
    expect((await getCharacters(undefined, origin)).status).toBe(200);
  });

  it("opens websocket sessions on localhost without a code", async () => {
    const chat = await connect({
      characterId: "princip",
      playerId: newPlayerId(),
      accessCode: null,
      baseUrl: LOCAL_ORIGINS[0],
    });
    expect(await chat.next()).toMatchObject({ type: "history" });
  });

  it.each([BASE_URL, "https://chrono-digger.example.workers.dev", "https://localhost.evil.test"])(
    "keeps character reads closed on %s",
    async (origin) => {
      expect((await getCharacters(undefined, origin)).status).toBe(401);
    },
  );

  it("keeps websocket sessions closed outside localhost", async () => {
    const chat = await connect({ characterId: "princip", playerId: newPlayerId(), accessCode: null });
    expect(await chat.next()).toMatchObject({ type: "error", error: "bad_access_code" });
  });
});
