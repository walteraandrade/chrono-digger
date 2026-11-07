import type { CaseResult } from "./eval-client.ts";
import type { EvalCase, EvalSuite } from "./eval-cases.ts";
import { type Judgments, isTrap } from "./eval-judge.ts";

export const PASS_RATE_TARGET = 0.9;

export type OverallVerdict = "approved" | "rejected" | "incomplete";

export type CaseLine = { evalCase: EvalCase; answer?: string; note: string };

export type ThreadLine = { id: string; question: string; status: "pass" | "fail" | "pending"; note: string };

export type Report = {
  total: number;
  passed: number;
  passRate: number;
  failures: CaseLine[];
  inventions: CaseLine[];
  pending: CaseLine[];
  threads: ThreadLine[];
  verdict: OverallVerdict;
  reasons: string[];
};

const answerOf = (result: CaseResult | undefined) => (result?.status === "answered" ? result.text : undefined);

const pendingNote = (result: CaseResult | undefined, judgmentError: string | undefined) => {
  if (judgmentError) return `judge error: ${judgmentError}`;
  if (result?.status === "failed") return `no answer: ${result.error}`;
  if (result?.status === "answered") return "not judged yet";
  return "not asked yet";
};

export const buildReport = (
  suite: EvalSuite,
  results: Readonly<Record<string, CaseResult>>,
  judgments: Judgments,
): Report => {
  const lines = suite.cases.map((evalCase) => {
    const result = results[evalCase.id];
    const judgment = judgments.cases[evalCase.id];
    const judged = judgment?.status === "judged" ? judgment : undefined;
    const error = judgment?.status === "judge_error" ? judgment.error : undefined;
    return {
      judged,
      line: {
        evalCase,
        answer: answerOf(result),
        note: judged?.justification ?? pendingNote(result, error),
      },
    };
  });
  const passed = lines.filter(({ judged }) => judged?.verdict === "pass").length;
  const failures = lines.filter(({ judged }) => judged?.verdict === "fail").map(({ line }) => line);
  const inventions = lines
    .filter(({ judged, line }) => judged?.invented === true && isTrap(line.evalCase))
    .map(({ line }) => line);
  const pending = lines.filter(({ judged }) => !judged).map(({ line }) => line);

  const threads = suite.threads.map((thread): ThreadLine => {
    const judgment = judgments.threads[thread.id];
    const base = { id: thread.id, question: thread.question };
    if (judgment?.status === "judged")
      return { ...base, status: judgment.verdict, note: `${judgment.justification} Conclusion: ${judgment.conclusion}` };
    return {
      ...base,
      status: "pending",
      note: judgment?.status === "judge_error" ? `judge error: ${judgment.error}` : "pieces not all answered or not judged yet",
    };
  });

  const total = suite.cases.length;
  const passRate = total === 0 ? 0 : passed / total;
  const failedThreads = threads.filter(({ status }) => status === "fail");
  const pendingThreads = threads.filter(({ status }) => status === "pending");
  const isPending = pending.length > 0 || pendingThreads.length > 0;

  const reasons = [
    ...(inventions.length > 0 ? [`${inventions.length} invention(s) on trap questions`] : []),
    ...(failedThreads.length > 0 ? [`threads failed: ${failedThreads.map(({ id }) => id).join(", ")}`] : []),
    ...(!isPending && passRate < PASS_RATE_TARGET ? [`pass rate below ${PASS_RATE_TARGET * 100}%`] : []),
    ...(pending.length > 0 ? [`${pending.length} case(s) without a judgment`] : []),
    ...(pendingThreads.length > 0 ? [`${pendingThreads.length} thread(s) without a judgment`] : []),
  ];

  const isRejected =
    inventions.length > 0 || failedThreads.length > 0 || (!isPending && passRate < PASS_RATE_TARGET);
  const verdict: OverallVerdict = isRejected ? "rejected" : isPending ? "incomplete" : "approved";

  return { total, passed, passRate, failures, inventions, pending, threads, verdict, reasons };
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const caseBlock = ({ evalCase, answer, note }: CaseLine) =>
  [
    `### ${evalCase.id} (${evalCase.category})`,
    "",
    `- **Question:** ${evalCase.question}`,
    ...(answer === undefined ? [] : [`- **Answer:** ${answer.replaceAll("\n", " ")}`]),
    `- **Note:** ${note}`,
    "",
  ].join("\n");

const section = (title: string, lines: readonly CaseLine[]) =>
  lines.length === 0 ? [`## ${title}`, "", "None.", ""].join("\n") : [`## ${title}`, "", ...lines.map(caseBlock)].join("\n");

export type ReportMeta = { runId: string; provider: string; commit: string; judge: string };

export const renderReport = (report: Report, { runId, provider, commit, judge }: ReportMeta) =>
  [
    `# Fidelity eval: ${runId}`,
    "",
    `- **Verdict:** ${report.verdict}${report.reasons.length > 0 ? ` (${report.reasons.join("; ")})` : ""}`,
    `- **Pass rate:** ${report.passed}/${report.total} (${percent(report.passRate)}), target ${percent(PASS_RATE_TARGET)}`,
    `- **Trap inventions:** ${report.inventions.length}, target 0`,
    `- **Characters:** ${provider}, commit ${commit}`,
    `- **Judge:** ${judge}`,
    "",
    "## Threads",
    "",
    "| Thread | Result | Note |",
    "|---|---|---|",
    ...report.threads.map(
      ({ id, status, note }) => `| \`${id}\` | ${status} | ${note.replaceAll("\n", " ").replaceAll("|", "\\|")} |`,
    ),
    "",
    section("Trap inventions", report.inventions),
    section("Failures", report.failures),
    section("Pending", report.pending),
  ].join("\n");
