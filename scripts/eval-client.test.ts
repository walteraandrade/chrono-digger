import { describe, expect, it } from "vitest";
import { type Answer, type CaseToRun, MAX_CONSECUTIVE_FAILURES, runCases } from "./eval-client.ts";

const evalCase = (id: string): CaseToRun => ({ id, character: "princip", question: `q ${id}` });

const answered: Answer = { status: "answered", text: "a", sources: [] };

const failed = (error: "provider_failure" | "global_rate_limited" | "bad_access_code" | "timeout"): Answer => ({
  status: "failed",
  error,
});

const run = async (
  ids: string[],
  answers: Record<string, Answer>,
  previous: Parameters<typeof runCases>[0]["previous"] = {},
) => {
  const asked: string[] = [];
  const saved: string[][] = [];
  const outcome = await runCases({
    cases: ids.map(evalCase),
    previous,
    ask: async ({ id }) => {
      asked.push(id);
      return answers[id] ?? answered;
    },
    onResult: (results) => {
      saved.push(Object.keys(results));
    },
    now: () => new Date("2026-11-05T00:00:00Z"),
  });
  return { ...outcome, asked, saved };
};

describe("runCases", () => {
  it("asks every case in order and saves after each one", async () => {
    const { results, stopped, asked, saved } = await run(["a", "b"], {});
    expect(asked).toEqual(["a", "b"]);
    expect(saved).toEqual([["a"], ["a", "b"]]);
    expect(stopped).toBeUndefined();
    expect(results.a).toMatchObject({ id: "a", status: "answered", finishedAt: "2026-11-05T00:00:00.000Z" });
  });

  it("skips answered cases and retries failed ones on resume", async () => {
    const previous = {
      a: { ...answered, id: "a", finishedAt: "old" },
      b: { ...failed("provider_failure"), id: "b", finishedAt: "old" },
    };
    const { results, asked } = await run(["a", "b"], {}, previous);
    expect(asked).toEqual(["b"]);
    expect(results.a?.finishedAt).toBe("old");
    expect(results.b?.status).toBe("answered");
  });

  it("keeps going after an isolated failure", async () => {
    const { results, stopped, asked } = await run(["a", "b"], { a: failed("timeout") });
    expect(asked).toEqual(["a", "b"]);
    expect(stopped).toBeUndefined();
    expect(results.a).toMatchObject({ status: "failed", error: "timeout" });
  });

  it("stops after too many failures in a row", async () => {
    const ids = Array.from({ length: MAX_CONSECUTIVE_FAILURES + 2 }, (_, index) => `c${index}`);
    const answers = Object.fromEntries(ids.map((id) => [id, failed("provider_failure")]));
    const { stopped, asked } = await run(ids, answers);
    expect(asked).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    expect(stopped).toContain("failures in a row");
  });

  it.each(["global_rate_limited", "bad_access_code"] as const)(
    "stops at once on %s without recording the case",
    async (error) => {
      const { results, stopped, asked } = await run(["a", "b"], { a: failed(error) });
      expect(asked).toEqual(["a"]);
      expect(stopped).toBe(`a: ${error}`);
      expect(results).toEqual({});
    },
  );
});
