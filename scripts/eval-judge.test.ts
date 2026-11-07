import * as Stream from "effect/Stream";
import { describe, expect, it } from "vitest";
import { type ChatMessage, type ChatProvider, ProviderError } from "../src/providers/types.ts";
import type { CaseResult } from "./eval-client.ts";
import type { EvalCase, EvalSuite } from "./eval-cases.ts";
import { type Judgments, judgeCase, judgeThread, parseVerdict, runJudge } from "./eval-judge.ts";

const verdictJson = (verdict: string, invented = false) =>
  JSON.stringify({ verdict, invented, justification: "motivo" });

const scriptedChat = (replies: readonly (string | Error)[]) => {
  const calls: ChatMessage[][] = [];
  const chat: ChatProvider = {
    name: "scripted",
    stream: (messages) =>
      Stream.suspend(() => {
        const reply = replies[calls.length] ?? verdictJson("pass");
        calls.push(messages);
        return reply instanceof Error
          ? Stream.fail(new ProviderError({ message: reply.message }))
          : Stream.make(reply.slice(0, 3), reply.slice(3));
      }),
  };
  return { chat, calls };
};

const evalCase = (id: string, overrides: Partial<EvalCase> = {}): EvalCase => ({
  id,
  character: "princip",
  thread: null,
  category: "fact",
  question: `q ${id}`,
  expected: `SECRET rubric ${id}`,
  source: `SECRET source ${id}`,
  ...overrides,
});

const answered = (id: string, text = `a ${id}`): CaseResult => ({
  status: "answered",
  id,
  text,
  sources: [],
  finishedAt: "t",
});

const noJudgments: Judgments = { cases: {}, threads: {} };

describe("parseVerdict", () => {
  it("reads a verdict wrapped in prose or a code fence", () => {
    expect(parseVerdict(`Claro:\n\`\`\`json\n${verdictJson("fail", true)}\n\`\`\``)).toEqual({
      verdict: "fail",
      invented: true,
      justification: "motivo",
    });
  });

  it.each(["", "pass", "{not json}", '{"verdict":"maybe","justification":"x"}', '{"verdict":"pass"}'])(
    "rejects %j",
    (text) => {
      expect(parseVerdict(text)).toBeUndefined();
    },
  );
});

describe("judgeCase", () => {
  it("sends question, answer and rubric but not the source", async () => {
    const { chat, calls } = scriptedChat([verdictJson("pass")]);
    const judgment = await judgeCase(chat, evalCase("a"), "minha resposta");
    expect(judgment).toEqual({ status: "judged", verdict: "pass", invented: false, justification: "motivo" });
    const sent = JSON.stringify(calls[0]);
    expect(sent).toContain("q a");
    expect(sent).toContain("minha resposta");
    expect(sent).toContain("SECRET rubric a");
    expect(sent).not.toContain("SECRET source");
  });

  it("makes an invention on a trap question a failure, whatever the verdict says", async () => {
    const { chat } = scriptedChat([verdictJson("pass", true)]);
    expect(await judgeCase(chat, evalCase("a", { category: "myth" }), "x")).toMatchObject({
      verdict: "fail",
      invented: true,
    });
  });

  it("does not count inventions outside trap categories", async () => {
    const { chat } = scriptedChat([verdictJson("pass", true)]);
    expect(await judgeCase(chat, evalCase("a"), "x")).toMatchObject({ verdict: "pass", invented: false });
  });

  it("retries once on an unreadable verdict", async () => {
    const { chat, calls } = scriptedChat(["nope", verdictJson("fail")]);
    expect(await judgeCase(chat, evalCase("a"), "x")).toMatchObject({ verdict: "fail" });
    expect(calls).toHaveLength(2);
  });

  it("reports an error, never a pass, when the judge stays unreadable or the provider fails", async () => {
    expect(await judgeCase(scriptedChat(["nope", "nope"]).chat, evalCase("a"), "x")).toEqual({
      status: "judge_error",
      error: "judge did not return a valid verdict",
    });
    expect(await judgeCase(scriptedChat([new Error("boom")]).chat, evalCase("a"), "x")).toEqual({
      status: "judge_error",
      error: "boom",
    });
  });
});

describe("judgeThread", () => {
  const thread = { id: "rota", question: "Por quê?", pieces: ["a"], conclusion: "SECRET conclusion" };

  it("writes the conclusion blind, then compares it with the expected one", async () => {
    const { chat, calls } = scriptedChat(["Minha conclusão", verdictJson("pass")]);
    const judgment = await judgeThread(chat, thread, [{ character: "princip", text: "peça" }]);
    expect(judgment).toEqual({
      status: "judged",
      conclusion: "Minha conclusão",
      verdict: "pass",
      justification: "motivo",
    });
    expect(JSON.stringify(calls[0])).toContain("peça");
    expect(JSON.stringify(calls[0])).not.toContain("SECRET");
    expect(JSON.stringify(calls[1])).toContain("Minha conclusão");
    expect(JSON.stringify(calls[1])).toContain("SECRET conclusion");
  });
});

describe("runJudge", () => {
  const suite: EvalSuite = {
    threads: [{ id: "t", question: "q", pieces: ["a", "b"], conclusion: "c" }],
    cases: [evalCase("a", { thread: "t" }), evalCase("b", { thread: "t" })],
  };
  const results = { a: answered("a"), b: answered("b") };

  it("judges every case and thread, saving after each one", async () => {
    const { chat } = scriptedChat([verdictJson("pass"), verdictJson("fail"), "conclusão", verdictJson("pass")]);
    const saved: string[] = [];
    const { judgments, stopped } = await runJudge({
      suite,
      results,
      previous: noJudgments,
      chat,
      onUpdate: (_, id) => {
        saved.push(id);
      },
    });
    expect(saved).toEqual(["a", "b", "t"]);
    expect(stopped).toBeUndefined();
    expect(judgments.cases.b).toMatchObject({ verdict: "fail" });
    expect(judgments.threads.t).toMatchObject({ verdict: "pass", conclusion: "conclusão" });
  });

  it("skips what is already judged and retries judge errors", async () => {
    const { chat, calls } = scriptedChat([verdictJson("pass"), "conclusão", verdictJson("pass")]);
    const { judgments } = await runJudge({
      suite,
      results,
      previous: {
        cases: {
          a: { status: "judged", verdict: "fail", invented: false, justification: "antes" },
          b: { status: "judge_error", error: "boom" },
        },
        threads: {},
      },
      chat,
      onUpdate: () => undefined,
    });
    expect(calls).toHaveLength(3);
    expect(judgments.cases.a).toMatchObject({ justification: "antes" });
    expect(judgments.cases.b).toMatchObject({ status: "judged" });
  });

  it("does not judge unanswered cases or threads missing a piece", async () => {
    const { chat, calls } = scriptedChat([]);
    const { judgments } = await runJudge({
      suite,
      results: { a: answered("a"), b: { status: "failed", error: "timeout", id: "b", finishedAt: "t" } },
      previous: noJudgments,
      chat,
      onUpdate: () => undefined,
    });
    expect(calls).toHaveLength(1);
    expect(judgments.cases.b).toBeUndefined();
    expect(judgments.threads.t).toBeUndefined();
  });

  it("stops after too many judge errors in a row", async () => {
    const cases = ["a", "b", "c", "d"].map((id) => evalCase(id));
    const { chat, calls } = scriptedChat(cases.map(() => new Error("boom")));
    const { stopped } = await runJudge({
      suite: { threads: [], cases },
      results: Object.fromEntries(cases.map(({ id }) => [id, answered(id)])),
      previous: noJudgments,
      chat,
      onUpdate: () => undefined,
    });
    expect(stopped).toBe("3 judge errors in a row, last: c");
    expect(calls).toHaveLength(3);
  });
});
