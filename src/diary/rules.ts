import type { CaseLine, DiaryCase, SuggestedQuestion, Trigger } from "./cases";

export type CompletedTurn = {
  characterId: string;
  question: string;
  answer: string;
  chunkIds: readonly string[];
};

export type Progress = ReadonlyMap<string, string | null>;

export type DiaryLine = {
  id: string;
  owner: string;
  text: string;
  blank?: { filled: boolean; word?: string };
  secret: boolean;
};

export type DiaryView = {
  caseQuestion: string;
  lines: DiaryLine[];
  filled: number;
  total: number;
  secretsOpen: number;
  suggestions: SuggestedQuestion[];
};

const toWords = (text: string): readonly string[] =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

const containsTerm = (words: readonly string[], term: string) => {
  const termWords = toWords(term);
  return words.some((_, start) => termWords.every((word, offset) => words[start + offset] === word));
};

const containsAnyTerm = (text: string, terms: readonly string[]) => {
  const words = toWords(text);
  return terms.some((term) => containsTerm(words, term));
};

const fires = (trigger: Trigger, turn: CompletedTurn) => {
  switch (trigger.kind) {
    case "start":
      return false;
    case "chunk":
      return turn.chunkIds.includes(trigger.chunkId);
    case "askedAbout":
      return containsAnyTerm(turn.question, trigger.terms);
    case "saidWord":
      return containsAnyTerm(turn.answer, trigger.terms);
  }
};

export const matchTriggers = (lines: readonly CaseLine[], turn: CompletedTurn) =>
  lines.filter(({ owner, trigger }) => owner === turn.characterId && fires(trigger, turn)).map(({ id }) => id);

export const initialLineIds = (lines: readonly CaseLine[]) =>
  lines.filter(({ trigger }) => trigger.kind === "start").map(({ id }) => id);

const canonical = (text: string) => toWords(text).join(" ");

export const findAcceptedAnswer = ({ accepted = [] }: CaseLine, word: string) => {
  const answer = canonical(word);
  return answer === "" ? undefined : accepted.find((option) => canonical(option) === answer);
};

export const checkAnswer = (line: CaseLine, word: string) => findAcceptedAnswer(line, word) !== undefined;

const toDiaryLine = ({ id, owner, text, accepted, secret }: CaseLine, word: string | null): DiaryLine => ({
  id,
  owner,
  text,
  secret,
  ...(accepted && { blank: word === null ? { filled: false } : { filled: true, word } }),
});

export const toDiaryView = ({ question, lines, suggestions }: DiaryCase, progress: Progress): DiaryView => {
  const open = lines.filter(({ id }) => progress.has(id));
  const isDone = ({ id, accepted }: CaseLine) => !accepted || progress.get(id) != null;
  const secretsOpen = open.filter(({ secret }) => secret).length;
  return {
    caseQuestion: question,
    lines: open.map((line) => toDiaryLine(line, progress.get(line.id) ?? null)),
    filled: open.filter(isDone).length,
    total: lines.filter(({ secret }) => !secret).length + secretsOpen,
    secretsOpen,
    suggestions: [...suggestions],
  };
};
