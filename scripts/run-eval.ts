import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type CaseResult, type Connect, RESULTS_DIR, type RunFile, askCharacter, runCases } from "./eval-client.ts";
import { type EvalCase, loadSuite } from "./eval-cases.ts";

const PROVIDERS = ["workers-ai", "openrouter"];
const SERVER_READY_TIMEOUT_MS = 90_000;
const LOCAL_GLOBAL_DAILY_LIMIT = "1000";
const OPENROUTER_REQUIRED_ENV = ["OPENROUTER_API_KEY", "CLOUDFLARE_ACCOUNT_ID"];
const OPENROUTER_OPTIONAL_ENV = ["AI_GATEWAY_ID", "AI_GATEWAY_TOKEN"];

const { values: args } = parseArgs({
  options: {
    provider: { type: "string" },
    run: { type: "string" },
    case: { type: "string", multiple: true },
    port: { type: "string", default: "8799" },
    file: { type: "string", default: "eval/cases.json" },
    check: { type: "boolean", default: false },
  },
});

const connect: Connect = async (url, { onMessage, onClose }) => {
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => onMessage(String(event.data)));
  socket.addEventListener("close", onClose);
  return { send: (data) => socket.send(data), close: () => socket.close(1000) };
};

const writeOpenRouterEnv = async () => {
  const missing = OPENROUTER_REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`missing environment variables: ${missing.join(", ")}`);
  const dir = await mkdtemp(join(tmpdir(), "chrono-eval-"));
  const lines = [...OPENROUTER_REQUIRED_ENV, ...OPENROUTER_OPTIONAL_ENV]
    .filter((name) => process.env[name])
    .map((name) => `${name}=${process.env[name]}`);
  const path = join(dir, "server.env");
  await writeFile(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  return { path, remove: () => rmSync(dir, { recursive: true, force: true }) };
};

const serverProcessEnv = () => {
  const { CLOUDFLARE_API_TOKEN: _token, CLOUDFLARE_ACCOUNT_ID: _account, ...env } = process.env;
  return env;
};

const startServer = (provider: string, port: string, accessCode: string, envFile: string | undefined) =>
  spawn(
    "node_modules/.bin/wrangler",
    [
      "dev",
      "--port",
      port,
      "--persist-to",
      ".wrangler/eval",
      "--show-interactive-dev-session=false",
      "--log-level",
      "warn",
      "--var",
      `ACCESS_CODE:${accessCode}`,
      "--var",
      `CHAT_PROVIDER:${provider}`,
      "--var",
      `GLOBAL_DAILY_LIMIT:${LOCAL_GLOBAL_DAILY_LIMIT}`,
      ...(envFile ? ["--env-file", envFile] : []),
    ],
    { stdio: ["ignore", "inherit", "inherit"], detached: true, env: serverProcessEnv() },
  );

const stopServer = (server: ChildProcess) => {
  if (server.pid === undefined || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    return;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async (server: ChildProcess, baseUrl: string, accessCode: string) => {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`wrangler dev exited with code ${server.exitCode}`);
    const status = await fetch(`${baseUrl}/api/characters`, { headers: { "x-access-code": accessCode } })
      .then((response) => response.status)
      .catch(() => undefined);
    if (status === 200) return;
    if (status === 401) throw new Error("server rejected the eval access code; does another process use this port?");
    await sleep(500);
  }
  throw new Error(`wrangler dev not ready after ${SERVER_READY_TIMEOUT_MS} ms`);
};

const currentCommit = () => execFileSync("git", ["describe", "--always", "--dirty"], { encoding: "utf8" }).trim();

const readRunFile = (path: string) =>
  readFile(path, "utf8")
    .then((text) => JSON.parse(text) as RunFile)
    .catch(() => undefined);

const selectCases = (cases: readonly EvalCase[], ids: readonly string[] | undefined) => {
  const unknown = (ids ?? []).filter((id) => !cases.some((evalCase) => evalCase.id === id));
  if (unknown.length > 0) throw new Error(`unknown case: ${unknown.join(", ")}`);
  return ids ? cases.filter((evalCase) => ids.includes(evalCase.id)) : [...cases];
};

const summarize = (selected: readonly EvalCase[], results: Record<string, CaseResult>) => {
  const finished = selected.map((evalCase) => results[evalCase.id]);
  const answered = finished.filter((result) => result?.status === "answered");
  const withoutSources = answered.filter((result) => result.status === "answered" && result.sources.length === 0);
  const failed = finished.filter((result) => result?.status === "failed");
  return {
    answered: answered.length,
    failed: failed.length,
    missing: finished.length - answered.length - failed.length,
    withoutSources: withoutSources.length,
  };
};

const main = async () => {
  const suite = await loadSuite(args.file);
  if (args.check) return console.log(`valid: ${suite.cases.length} cases, ${suite.threads.length} threads`);

  const provider = args.provider ?? "";
  if (!PROVIDERS.includes(provider)) throw new Error(`--provider must be one of: ${PROVIDERS.join(", ")}`);
  const selected = selectCases(suite.cases, args.case);
  const runId = args.run ?? `${provider}-${new Date().toISOString().replace(/[-:]|\.\d+Z$/g, "")}`;
  const path = join(RESULTS_DIR, `${runId}.json`);
  const existing = await readRunFile(path);
  if (existing && existing.provider !== provider)
    throw new Error(`run ${runId} used provider ${existing.provider}, not ${provider}`);
  const run: RunFile = existing ?? {
    runId,
    provider,
    commit: currentCommit(),
    startedAt: new Date().toISOString(),
    results: {},
  };
  await mkdir(RESULTS_DIR, { recursive: true });

  const accessCode = randomUUID();
  const baseUrl = `http://localhost:${args.port}`;
  const serverEnv = provider === "openrouter" ? await writeOpenRouterEnv() : undefined;
  const server = startServer(provider, args.port, accessCode, serverEnv?.path);
  const stopOnSignal = () => {
    stopServer(server);
    serverEnv?.remove();
    process.exit(130);
  };
  process.once("SIGINT", stopOnSignal);
  process.once("SIGTERM", stopOnSignal);

  try {
    await waitForServer(server, baseUrl, accessCode);
    const { results, stopped } = await runCases({
      cases: selected,
      previous: run.results,
      ask: ({ character, question }) => askCharacter({ connect, baseUrl, accessCode }, character, question),
      onResult: async (updated, { id }) => {
        await writeFile(path, `${JSON.stringify({ ...run, results: updated }, null, 2)}\n`);
        console.log(`${id}: ${updated[id]?.status === "answered" ? "answered" : `failed (${JSON.stringify(updated[id])})`}`);
      },
    });
    const summary = summarize(selected, results);
    console.log(`run ${runId} (${provider}):`, summary);
    console.log(`results: ${path}`);
    if (summary.answered > 0 && summary.withoutSources === summary.answered)
      console.warn("warning: no answer had a source; is the corpus indexed? (pnpm index:corpus)");
    if (stopped) console.error(`stopped early: ${stopped}`);
    if (stopped || summary.answered < selected.length) {
      console.error(`resume with: pnpm eval:run --provider ${provider} --run ${runId}`);
      process.exitCode = 1;
    }
  } finally {
    stopServer(server);
    serverEnv?.remove();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
