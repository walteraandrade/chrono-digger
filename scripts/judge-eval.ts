import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_OPENROUTER_CHAT_MODEL, createOpenRouterProvider } from "../src/providers/openrouter.ts";
import type { ChatProvider } from "../src/providers/types.ts";
import { DEFAULT_WORKERS_AI_CHAT_MODEL, createWorkersAiProvider } from "../src/providers/workers-ai.ts";
import { restAiRunner } from "./cloudflare-rest.ts";
import { RESULTS_DIR, type RunFile } from "./eval-client.ts";
import { loadSuite } from "./eval-cases.ts";
import { type Judgments, runJudge } from "./eval-judge.ts";
import { buildReport, renderReport } from "./eval-report.ts";

const REPORTS_DIR = "eval/reports";

type JudgeFile = { runId: string; judge: string; judgments: Judgments };

const { values: args } = parseArgs({
  options: {
    run: { type: "string" },
    "judge-provider": { type: "string", default: "workers-ai" },
    "judge-model": { type: "string" },
    file: { type: "string", default: "eval/cases.json" },
  },
});

const env = process.env;

const required = (name: string) => {
  const value = env[name];
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
};

const selectJudge = (provider: string, model: string | undefined): { chat: ChatProvider; label: string } => {
  const gatewayId = env.AI_GATEWAY_ID || undefined;
  const gatewayToken = env.AI_GATEWAY_TOKEN || undefined;
  if (provider === "workers-ai") {
    const chatModel = model ?? DEFAULT_WORKERS_AI_CHAT_MODEL;
    return {
      label: `workers-ai / ${chatModel}`,
      chat: createWorkersAiProvider({
        chatModel,
        ai: restAiRunner({
          accountId: required("CLOUDFLARE_ACCOUNT_ID"),
          token: required("CLOUDFLARE_API_TOKEN"),
          gatewayId,
          gatewayToken,
        }),
      }),
    };
  }
  if (provider === "openrouter") {
    const chatModel = model ?? DEFAULT_OPENROUTER_CHAT_MODEL;
    return {
      label: `openrouter / ${chatModel}`,
      chat: createOpenRouterProvider({
        chatModel,
        apiKey: required("OPENROUTER_API_KEY"),
        accountId: required("CLOUDFLARE_ACCOUNT_ID"),
        gatewayId: required("AI_GATEWAY_ID"),
        gatewayToken,
      }),
    };
  }
  throw new Error(`unknown --judge-provider "${provider}"`);
};

const readJson = <T>(path: string) =>
  readFile(path, "utf8")
    .then((text) => JSON.parse(text) as T)
    .catch(() => undefined);

const main = async () => {
  if (!args.run) throw new Error("--run <id> is required");
  const suite = await loadSuite(args.file);
  const runPath = join(RESULTS_DIR, `${args.run}.json`);
  const run = await readJson<RunFile>(runPath);
  if (!run) throw new Error(`no answers at ${runPath}; run pnpm eval:run first`);

  const { chat, label } = selectJudge(args["judge-provider"], args["judge-model"]);
  const judgePath = join(RESULTS_DIR, `${args.run}.judge.json`);
  const existing = await readJson<JudgeFile>(judgePath);
  if (existing && existing.judge !== label)
    throw new Error(`${judgePath} was judged by ${existing.judge}, not ${label}; move it to judge again`);

  const { judgments, stopped } = await runJudge({
    suite,
    results: run.results,
    previous: existing?.judgments ?? { cases: {}, threads: {} },
    chat,
    onUpdate: async (updated, id) => {
      await writeFile(judgePath, `${JSON.stringify({ runId: run.runId, judge: label, judgments: updated }, null, 2)}\n`);
      const judgment = updated.cases[id] ?? updated.threads[id];
      console.log(`${id}: ${judgment?.status === "judged" ? judgment.verdict : `judge error (${judgment?.error})`}`);
    },
  });

  const report = buildReport(suite, run.results, judgments);
  const reportPath = join(REPORTS_DIR, `${run.runId}.md`);
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(
    reportPath,
    `${renderReport(report, { runId: run.runId, provider: run.provider, commit: run.commit, judge: label })}\n`,
  );

  console.log(`verdict: ${report.verdict}`, report.reasons);
  console.log(`pass rate: ${report.passed}/${report.total}; trap inventions: ${report.inventions.length}`);
  console.log(`report: ${reportPath}`);
  if (stopped) console.error(`stopped early: ${stopped}`);
  if (report.verdict !== "approved") process.exitCode = 1;
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
