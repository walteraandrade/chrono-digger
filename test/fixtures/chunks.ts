import type { Chunk } from "../../src/providers/types";

const pharos = {
  sourceTitle: "Der Prozeß gegen die Attentäter von Sarajewo",
  author: "Pharos (ed.)",
  year: 1918,
  license: "public-domain",
  url: "https://archive.org/details/derprozessgegend01prin",
  language: "de",
};

export const fixtureChunks: readonly Chunk[] = [
  {
    ...pharos,
    id: "princip-p24",
    characterId: "princip",
    location: "p. 24",
    passage: "Dem Ciganovic sagte ich, er solle uns Bomben geben.",
  },
  {
    ...pharos,
    id: "princip-p30",
    characterId: "princip",
    location: "p. 30",
    passage: "stellte mich an der Straßenecke vor einem Kaufladen auf",
  },
  {
    ...pharos,
    id: "harrach-p158",
    characterId: "harrach",
    location: "p. 158",
    passage: "bevor die Bombe fiel, deutlich einen Schuß gehört",
  },
  {
    ...pharos,
    id: "harrach-p159",
    characterId: "harrach",
    location: "p. 159",
    passage: "Sopherl, Sopherl, sterbe nicht, bleibe am Leben für unsere Kinder!",
  },
  {
    ...pharos,
    id: "potiorek-p157",
    characterId: "potiorek",
    location: "p. 157",
    passage: "weil auf diese Fahrt längs des Quai niemand gefaßt sei",
  },
];
