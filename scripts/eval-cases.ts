import { readFile } from "node:fs/promises";
import { characters } from "../src/characters.ts";
import { MAX_QUESTION_LENGTH } from "../src/contract.ts";

export const CATEGORIES = ["fact", "unknown", "myth", "future", "second-hand", "safety", "no-spoiler"] as const;

export type Category = (typeof CATEGORIES)[number];

export type EvalCase = {
  id: string;
  character: string;
  thread: string | null;
  category: Category;
  question: string;
  expected: string;
  source: string;
};

export type EvalThread = { id: string; question: string; pieces: string[]; conclusion: string };

export type EvalSuite = { threads: EvalThread[]; cases: EvalCase[] };

type Loose = Record<string, unknown>;

const knownCharacters = new Set(characters.map((character) => character.id));

const isFilledString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const missingFields = (value: Loose, fields: readonly string[]) =>
  fields.filter((field) => !isFilledString(value[field])).map((field) => `missing or empty "${field}"`);

const caseShapeErrors = (value: Loose) => [
  ...missingFields(value, ["id", "character", "question", "expected", "source"]),
  ...(knownCharacters.has(String(value.character)) ? [] : [`unknown character "${String(value.character)}"`]),
  ...(CATEGORIES.includes(value.category as Category) ? [] : [`unknown category "${String(value.category)}"`]),
  ...(value.thread === null || isFilledString(value.thread) ? [] : ['"thread" must be a string or null']),
  ...(String(value.question).length <= MAX_QUESTION_LENGTH ? [] : [`question longer than ${MAX_QUESTION_LENGTH}`]),
  ...(String(value.id).startsWith(`${String(value.character)}-`) ? [] : ['"id" must start with the character']),
];

const threadShapeErrors = (value: Loose) => [
  ...missingFields(value, ["id", "question", "conclusion"]),
  ...(Array.isArray(value.pieces) && value.pieces.length > 0 ? [] : ['"pieces" must be a non-empty array']),
];

const duplicates = (ids: readonly string[]) =>
  [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].map((id) => `duplicate id "${id}"`);

const linkErrors = ({ threads, cases }: EvalSuite) => {
  const threadIds = new Set(threads.map((thread) => thread.id));
  const threadOf = new Map(cases.map((evalCase) => [evalCase.id, evalCase.thread]));
  return [
    ...cases
      .filter((evalCase) => evalCase.thread !== null && !threadIds.has(evalCase.thread))
      .map((evalCase) => `${evalCase.id}: unknown thread "${evalCase.thread}"`),
    ...threads.flatMap((thread) =>
      thread.pieces
        .filter((piece) => threadOf.get(piece) !== thread.id)
        .map((piece) => `thread ${thread.id}: piece "${piece}" is not a case of this thread`),
    ),
    ...cases
      .filter((evalCase) => threads.some((thread) => thread.id === evalCase.thread && !thread.pieces.includes(evalCase.id)))
      .map((evalCase) => `${evalCase.id}: missing from the pieces of thread "${evalCase.thread}"`),
  ];
};

const labelled = (label: unknown, errors: string[]) => errors.map((error) => `${String(label ?? "?")}: ${error}`);

export const validateSuite = (value: unknown): string[] => {
  const { threads, cases } = (value ?? {}) as { threads?: unknown; cases?: unknown };
  if (!Array.isArray(threads) || !Array.isArray(cases)) return ['expected "threads" and "cases" arrays'];
  const shapes = [
    ...(threads as Loose[]).flatMap((thread) => labelled(thread.id, threadShapeErrors(thread))),
    ...(cases as Loose[]).flatMap((evalCase) => labelled(evalCase.id, caseShapeErrors(evalCase))),
    ...duplicates((threads as Loose[]).map((thread) => String(thread.id))),
    ...duplicates((cases as Loose[]).map((evalCase) => String(evalCase.id))),
  ];
  return shapes.length > 0 ? shapes : linkErrors(value as EvalSuite);
};

export const loadSuite = async (path: string): Promise<EvalSuite> => {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  const errors = validateSuite(parsed);
  if (errors.length > 0) throw new Error(`invalid ${path}:\n${errors.join("\n")}`);
  return parsed as EvalSuite;
};
