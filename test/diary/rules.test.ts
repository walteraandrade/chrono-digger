import { describe, expect, it } from "vitest";
import albertini from "../../corpus/albertini-1953.json";
import pharosAlbertini from "../../corpus/pharos-1918-albertini.json";
import pharos from "../../corpus/pharos-1918.json";
import { BLANK, type CaseLine, sandwichCase } from "../../src/diary/cases";
import { type CompletedTurn, checkAnswer, initialLineIds, matchTriggers, toDiaryView } from "../../src/diary/rules";

const { lines } = sandwichCase;

const lineById = (id: string) => {
  const line = lines.find((candidate) => candidate.id === id);
  if (!line) throw new Error(`unknown line ${id}`);
  return line;
};

const turn = (overrides: Partial<CompletedTurn>): CompletedTurn => ({
  characterId: "princip",
  question: "",
  answer: "",
  chunkIds: [],
  ...overrides,
});

describe("matchTriggers", () => {
  it("opens every line tied to a retrieved chunk, but not the secret in the same chunk", () => {
    expect(matchTriggers(lines, turn({ chunkIds: ["pharos-1918-princip-16"] }))).toEqual([
      "princip-corner",
      "princip-shop",
    ]);
  });

  it("ignores a chunk retrieved for another character", () => {
    expect(matchTriggers(lines, turn({ characterId: "harrach", chunkIds: ["pharos-1918-princip-16"] }))).toEqual([]);
  });

  it("opens nothing for a question that retrieved no chunk", () => {
    expect(matchTriggers(lines, turn({ question: "vc tava onde na hora?", answer: "Não sei." }))).toEqual([]);
  });

  it.each(["Essa história do sanduíche é verdade?", "e o SANDUICHE?", "comeu sanduíches?", "Ele estava comendo?"])(
    "opens the askedAbout line for %j",
    (question) => {
      expect(matchTriggers(lines, turn({ characterId: "albertini", question }))).toEqual(["albertini-none"]);
    },
  );

  it("does not open an askedAbout line for another character", () => {
    expect(matchTriggers(lines, turn({ question: "Essa história do sanduíche é verdade?" }))).toEqual([]);
  });

  it("does not read askedAbout terms from the answer", () => {
    expect(matchTriggers(lines, turn({ characterId: "albertini", answer: "Sanduíche? Não sei." }))).toEqual([]);
  });

  it.each(["Um certo Pušara veio até mim.", "Foi o pusara, e só."])("opens the secret for the answer %j", (answer) => {
    expect(matchTriggers(lines, turn({ answer }))).toEqual(["princip-stranger"]);
  });

  it("does not open the secret when only the player says the word", () => {
    expect(matchTriggers(lines, turn({ question: "Quem é Pušara?", answer: "Não conheço." }))).toEqual([]);
  });

  it("does not open the secret when another character says the word", () => {
    expect(matchTriggers(lines, turn({ characterId: "harrach", answer: "Pušara?" }))).toEqual([]);
  });

  it("matches whole words only", () => {
    expect(matchTriggers(lines, turn({ characterId: "albertini", question: "Havia uma lanchonete?" }))).toEqual([]);
    expect(matchTriggers(lines, turn({ answer: "Pušaraj" }))).toEqual([]);
  });

  it("needs a term with several words complete and in order", () => {
    const line: CaseLine = {
      id: "test",
      owner: "princip",
      text: "test",
      secret: false,
      trigger: { kind: "saidWord", terms: ["Ponte Latina"] },
    };
    expect(matchTriggers([line], turn({ answer: "na ponte, latina!" }))).toEqual(["test"]);
    expect(matchTriggers([line], turn({ answer: "latina ponte" }))).toEqual([]);
    expect(matchTriggers([line], turn({ answer: "ponte bem latina" }))).toEqual([]);
  });

  it("never fires a start line", () => {
    expect(
      matchTriggers(lines, turn({ characterId: "case", question: "sanduíche", answer: "ninguém" })),
    ).toEqual([]);
  });
});

describe("initialLineIds", () => {
  it("opens only the verdict at the start", () => {
    expect(initialLineIds(lines)).toEqual(["case-verdict"]);
  });
});

describe("checkAnswer", () => {
  it.each([
    ["princip-corner", "esquina"],
    ["princip-corner", "  ESQUINA. "],
    ["princip-shop", "armazém"],
    ["princip-shop", "armazem"],
    ["princip-stranger", "Pusara"],
    ["princip-stranger", "pušara"],
    ["case-verdict", "nao"],
  ])("accepts %s = %j", (id, word) => {
    expect(checkAnswer(lineById(id), word)).toBe(true);
  });

  it.each([
    ["princip-corner", "loja"],
    ["princip-corner", "a esquina"],
    ["princip-corner", ""],
    ["princip-corner", " ... "],
    ["harrach-step", "estribos"],
  ])("rejects %s = %j", (id, word) => {
    expect(checkAnswer(lineById(id), word)).toBe(false);
  });

  it("rejects any word for a line without a blank", () => {
    expect(checkAnswer(lineById("albertini-none"), "sanduíche")).toBe(false);
  });
});

describe("sandwichCase", () => {
  const chunks = [...pharos, ...pharosAlbertini, ...albertini];

  it("has unique line ids", () => {
    expect(new Set(lines.map(({ id }) => id)).size).toBe(lines.length);
  });

  it.each(lines.map((line) => [line.id, line] as const))("%s has a blank only if it accepts answers", (_id, line) => {
    const blanks = line.text.split(BLANK).length - 1;
    expect(blanks).toBe(line.accepted ? 1 : 0);
    expect(line.accepted?.length ?? 1).toBeGreaterThan(0);
  });

  it("points chunk triggers at chunks of the line's owner", () => {
    const missing = lines.filter(
      ({ owner, trigger }) =>
        trigger.kind === "chunk" &&
        !chunks.some(({ id, characterId }) => id === trigger.chunkId && characterId === owner),
    );
    expect(missing).toEqual([]);
  });

  it("opens secrets only by what the character says", () => {
    const secrets = lines.filter(({ secret }) => secret);
    expect(secrets.map(({ trigger }) => trigger.kind)).toEqual(["saidWord"]);
  });

  it("never suggests a path to a secret", () => {
    const paths = sandwichCase.suggestions.filter(({ text }) => /esquina|conversou|falou|alguém|Pu[sš]ara/i.test(text));
    expect(paths).toEqual([]);
  });
});

describe("toDiaryView", () => {
  it("counts common lines plus open secrets, with no blank meaning done", () => {
    const view = toDiaryView(
      sandwichCase,
      new Map([
        ["albertini-none", null],
        ["case-verdict", "ninguém"],
        ["princip-corner", null],
        ["princip-stranger", null],
      ]),
    );
    expect(view).toMatchObject({ filled: 2, total: 7, secretsOpen: 1 });
    expect(view.lines.map(({ id }) => id)).toEqual([
      "princip-corner",
      "albertini-none",
      "case-verdict",
      "princip-stranger",
    ]);
  });

  it("hides closed secrets from the total", () => {
    expect(toDiaryView(sandwichCase, new Map())).toMatchObject({ lines: [], filled: 0, total: 6, secretsOpen: 0 });
  });
});
