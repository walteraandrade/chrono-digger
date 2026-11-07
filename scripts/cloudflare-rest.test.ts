import { describe, expect, it } from "vitest";
import { restAiRunner } from "./cloudflare-rest.ts";

const runnerAnswering = (response: Response) =>
  restAiRunner({ accountId: "acct", token: "t", fetcher: async () => response });

describe("restAiRunner", () => {
  it("unwraps the result of a JSON call", async () => {
    const runner = runnerAnswering(Response.json({ result: { data: [[1]] } }));
    expect(await runner.run("m", { text: ["a"] })).toEqual({ data: [[1]] });
  });

  it("returns the body of a streaming call", async () => {
    const runner = runnerAnswering(new Response("data: {}\n\n"));
    expect(await runner.run("m", { stream: true })).toBeInstanceOf(ReadableStream);
  });

  it("throws on an error status", async () => {
    const runner = runnerAnswering(new Response("nope", { status: 429 }));
    await expect(runner.run("m", {})).rejects.toThrow("429 nope");
  });
});
