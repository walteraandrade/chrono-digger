import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { type EvalSuite, loadSuite, validateSuite } from "./eval-cases.ts";

const CASES_PATH = "eval/cases.json";

const plain = (cell: string) => cell.replaceAll("`", "");

const docRows = async () =>
  (await readFile("docs/fidelity-eval.md", "utf8"))
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

const validSuite = (): EvalSuite => ({
  threads: [{ id: "rota", question: "q", pieces: ["princip-01"], conclusion: "c" }],
  cases: [
    {
      id: "princip-01",
      character: "princip",
      thread: "rota",
      category: "fact",
      question: "q",
      expected: "e",
      source: "s",
    },
  ],
});

describe("eval case file", () => {
  it("is valid", async () => {
    const suite = await loadSuite(CASES_PATH);
    expect(suite.cases.length).toBeGreaterThanOrEqual(30);
    expect(suite.threads.length).toBeGreaterThan(0);
  });

  it("matches every case and thread in docs/fidelity-eval.md", async () => {
    const { threads, cases } = await loadSuite(CASES_PATH);
    const rows = await docRows();
    const docCases = rows
      .filter((row) => row.length === 6)
      .map(([id, thread, category, question, expected, source]) => ({
        id: plain(id ?? ""),
        thread: thread === "—" ? null : plain(thread ?? ""),
        category,
        question,
        expected,
        source,
      }));
    const docThreads = rows
      .filter((row) => row.length === 4)
      .map(([id, question, pieces, conclusion]) => ({
        id: plain(id ?? ""),
        question,
        pieces: plain(pieces ?? "").split(", "),
        conclusion,
      }));
    expect(cases.map(({ character: _character, ...rest }) => rest)).toEqual(docCases);
    expect(threads).toEqual(docThreads);
  });
});

describe("validateSuite", () => {
  it("accepts a valid suite", () => {
    expect(validateSuite(validSuite())).toEqual([]);
  });

  it("reports missing fields, unknown characters and categories", () => {
    const suite = validSuite();
    const errors = validateSuite({
      ...suite,
      cases: [{ ...suite.cases[0], character: "lojka", category: "gossip", expected: " " }],
    });
    expect(errors).toContain('princip-01: missing or empty "expected"');
    expect(errors).toContain('princip-01: unknown character "lojka"');
    expect(errors).toContain('princip-01: unknown category "gossip"');
  });

  it("reports duplicate ids", () => {
    const suite = validSuite();
    expect(validateSuite({ ...suite, cases: [...suite.cases, ...suite.cases] })).toContain(
      'duplicate id "princip-01"',
    );
  });

  it("reports broken links between threads and cases", () => {
    const suite = validSuite();
    const [evalCase] = suite.cases;
    if (!evalCase) throw new Error("fixture has no case");
    expect(validateSuite({ ...suite, cases: [{ ...evalCase, thread: "armas" }] })).toEqual(
      expect.arrayContaining([
        'princip-01: unknown thread "armas"',
        'thread rota: piece "princip-01" is not a case of this thread',
      ]),
    );
    expect(validateSuite({ ...suite, threads: [{ ...suite.threads[0], pieces: ["harrach-01"] }] })).toEqual(
      expect.arrayContaining([
        'thread rota: piece "harrach-01" is not a case of this thread',
        'princip-01: missing from the pieces of thread "rota"',
      ]),
    );
  });
});
