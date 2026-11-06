import type { CaseLine, Trigger } from "./cases";

export type CompletedTurn = {
  characterId: string;
  question: string;
  answer: string;
  chunkIds: readonly string[];
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

export const checkAnswer = ({ accepted = [] }: CaseLine, word: string) => {
  const answer = canonical(word);
  return answer !== "" && accepted.some((option) => canonical(option) === answer);
};
