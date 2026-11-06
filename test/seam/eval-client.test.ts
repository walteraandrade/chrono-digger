import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { type Connect, type Transport, askCharacter } from "../../scripts/eval-client";
import { BASE_URL } from "../client";
import { TEST_ACCESS_CODE } from "../constants";
import { FAIL_TRIGGER } from "../fakes/providers";

const connect: Connect = async (url, { onMessage, onClose }) => {
  const { webSocket } = await SELF.fetch(url, { headers: { upgrade: "websocket" } });
  if (!webSocket) throw new Error("expected websocket");
  webSocket.addEventListener("message", (event) => onMessage(event.data as string));
  webSocket.addEventListener("close", onClose);
  webSocket.accept();
  return { send: (data) => webSocket.send(data), close: () => webSocket.close(1000) };
};

const transport: Transport = { connect, baseUrl: BASE_URL, accessCode: TEST_ACCESS_CODE };

describe("eval client through the Worker entry", () => {
  it("collects the streamed answer and its sources", async () => {
    const answer = await askCharacter(transport, "princip", "Ciganovic sagte Bomben geben?");
    expect(answer).toMatchObject({ status: "answered", text: "Resposta 1: Ciganovic sagte Bomben geben?" });
    expect(answer.status === "answered" && answer.sources.length).toBeGreaterThan(0);
  });

  it("starts every question without history", async () => {
    const first = await askCharacter(transport, "harrach", "Primeira");
    const second = await askCharacter(transport, "harrach", "Segunda");
    expect(first).toMatchObject({ text: "Resposta 1: Primeira" });
    expect(second).toMatchObject({ text: "Resposta 1: Segunda" });
  });

  it("is not stopped by the per-player limit", async () => {
    const answers = await Promise.all(
      Array.from({ length: 5 }, (_, index) => askCharacter(transport, "potiorek", `Pergunta ${index}`)),
    );
    expect(answers.every(({ status }) => status === "answered")).toBe(true);
  });

  it("discards partial text when the provider fails", async () => {
    expect(await askCharacter(transport, "princip", `Falha ${FAIL_TRIGGER}`)).toEqual({
      status: "failed",
      error: "provider_failure",
    });
  });

  it("reports a wrong access code", async () => {
    expect(await askCharacter({ ...transport, accessCode: "wrong" }, "princip", "Oi")).toEqual({
      status: "failed",
      error: "bad_access_code",
    });
  });

  it("reports an unknown character", async () => {
    expect(await askCharacter(transport, "lojka", "Oi")).toEqual({ status: "failed", error: "unknown_character" });
  });

  it("gives up when the server takes too long", async () => {
    expect(await askCharacter({ ...transport, timeoutMs: 0 }, "princip", "Oi")).toEqual({
      status: "failed",
      error: "timeout",
    });
  });
});
