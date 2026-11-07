import { describe, expect, it } from "vitest";
import type { CaseResult } from "./eval-client.ts";
import type { Category, EvalSuite } from "./eval-cases.ts";
import type { CaseJudgment, Judgments, ThreadJudgment } from "./eval-judge.ts";
import { buildReport, renderReport } from "./eval-report.ts";

const IDS = Array.from({ length: 10 }, (_, index) => `princip-${index}`);

const suiteWith = (categories: Partial<Record<string, Category>> = {}): EvalSuite => ({
  threads: [{ id: "t", question: "Por quê?", pieces: ["princip-0"], conclusion: "c" }],
  cases: IDS.map((id, index) => ({
    id,
    character: "princip",
    thread: index === 0 ? "t" : null,
    category: categories[id] ?? "fact",
    question: `q ${id}`,
    expected: "e",
    source: "s",
  })),
});

const results: Record<string, CaseResult> = Object.fromEntries(
  IDS.map((id) => [id, { status: "answered", id, text: `a ${id}`, sources: [], finishedAt: "t" }]),
);

const pass: CaseJudgment = { status: "judged", verdict: "pass", invented: false, justification: "ok" };
const fail: CaseJudgment = { status: "judged", verdict: "fail", invented: false, justification: "ruim" };
const threadPass: ThreadJudgment = { status: "judged", conclusion: "x", verdict: "pass", justification: "ok" };

const judgments = (overrides: Record<string, CaseJudgment> = {}, thread: ThreadJudgment = threadPass): Judgments => ({
  cases: { ...Object.fromEntries(IDS.map((id) => [id, pass])), ...overrides },
  threads: { t: thread },
});

describe("buildReport verdict", () => {
  it("approves at exactly 90% with no inventions and every thread passing", () => {
    const report = buildReport(suiteWith(), results, judgments({ "princip-1": fail }));
    expect(report).toMatchObject({ verdict: "approved", passed: 9, total: 10, passRate: 0.9, reasons: [] });
  });

  it("rejects below 90%", () => {
    const report = buildReport(suiteWith(), results, judgments({ "princip-1": fail, "princip-2": fail }));
    expect(report.verdict).toBe("rejected");
    expect(report.failures.map(({ evalCase }) => evalCase.id)).toEqual(["princip-1", "princip-2"]);
  });

  it("rejects on one trap invention even with a high pass rate", () => {
    const invented: CaseJudgment = { ...fail, invented: true } as CaseJudgment;
    const report = buildReport(suiteWith({ "princip-1": "myth" }), results, judgments({ "princip-1": invented }));
    expect(report.verdict).toBe("rejected");
    expect(report.passRate).toBe(0.9);
    expect(report.inventions.map(({ evalCase }) => evalCase.id)).toEqual(["princip-1"]);
  });

  it("rejects when a thread fails", () => {
    const report = buildReport(suiteWith(), results, judgments({}, { ...threadPass, verdict: "fail" } as ThreadJudgment));
    expect(report.verdict).toBe("rejected");
    expect(report.reasons).toContain("threads failed: t");
  });

  it("is incomplete, never approved, when a case has a judge error or no answer", () => {
    const { "princip-2": _, ...rest } = results;
    const report = buildReport(
      suiteWith(),
      rest,
      judgments({ "princip-1": { status: "judge_error", error: "boom" } }),
    );
    expect(report.verdict).toBe("incomplete");
    expect(report.pending.find(({ evalCase }) => evalCase.id === "princip-1")?.note).toBe("judge error: boom");
  });

  it("is incomplete when a thread has no judgment", () => {
    const report = buildReport(suiteWith(), results, { ...judgments(), threads: {} });
    expect(report.verdict).toBe("incomplete");
  });

  it("is incomplete for an empty run, with a 0% pass rate", () => {
    const report = buildReport(suiteWith(), {}, { cases: {}, threads: {} });
    expect(report).toMatchObject({ verdict: "incomplete", passed: 0, passRate: 0 });
    expect(report.pending[0]?.note).toBe("not asked yet");
  });
});

describe("renderReport", () => {
  it("shows verdict, rate, threads, inventions and failure justifications", () => {
    const invented: CaseJudgment = { ...fail, invented: true } as CaseJudgment;
    const text = renderReport(
      buildReport(suiteWith({ "princip-1": "myth" }), results, judgments({ "princip-1": invented })),
      { runId: "r1", provider: "workers-ai", commit: "abc", judge: "workers-ai / m" },
    );
    expect(text).toContain("rejected");
    expect(text).toContain("9/10 (90.0%)");
    expect(text).toContain("**Trap inventions:** 1, target 0");
    expect(text).toContain("| `t` | pass |");
    expect(text).toContain("### princip-1 (myth)");
    expect(text).toContain("ruim");
    expect(text).toContain("workers-ai / m");
  });
});
