export const BLANK = "____";
export const CASE_OWNER = "case";

export type Trigger =
  | { kind: "start" }
  | { kind: "chunk"; chunkId: string }
  | { kind: "askedAbout"; terms: readonly string[] }
  | { kind: "saidWord"; terms: readonly string[] };

export type CaseLine = {
  id: string;
  owner: string;
  text: string;
  accepted?: readonly string[];
  secret: boolean;
  trigger: Trigger;
};

export type SuggestedQuestion = { characterId: string; text: string };

export type DiaryCase = {
  id: string;
  question: string;
  lines: readonly CaseLine[];
  suggestions: readonly SuggestedQuestion[];
  closing: { text: string; references: readonly string[] };
};

export const sandwichCase: DiaryCase = {
  id: "sandwich",
  question: "Princip estava comendo um sanduíche?",
  lines: [
    {
      id: "princip-corner",
      owner: "princip",
      text: `Esperava na ${BLANK}`,
      accepted: ["esquina"],
      secret: false,
      trigger: { kind: "chunk", chunkId: "pharos-1918-princip-16" },
    },
    {
      id: "princip-shop",
      owner: "princip",
      text: `Estava diante de uma ${BLANK}`,
      accepted: ["loja", "armazém", "venda"],
      secret: false,
      trigger: { kind: "chunk", chunkId: "pharos-1918-princip-16" },
    },
    {
      id: "harrach-step",
      owner: "harrach",
      text: `Ficou no ${BLANK} do carro`,
      accepted: ["estribo"],
      secret: false,
      trigger: { kind: "chunk", chunkId: "pharos-1918-harrach-01" },
    },
    {
      id: "harrach-side",
      owner: "harrach",
      text: `Os tiros vieram do lado ${BLANK} ao dele`,
      accepted: ["oposto", "contrário", "outro"],
      secret: false,
      trigger: { kind: "chunk", chunkId: "pharos-1918-harrach-02" },
    },
    {
      id: "albertini-none",
      owner: "albertini",
      text: "Não encontrou essa história nas fontes dele",
      secret: false,
      trigger: {
        kind: "askedAbout",
        terms: ["sanduíche", "sanduíches", "sandwich", "sandwiches", "lanche", "lanches", "comendo"],
      },
    },
    {
      id: "case-verdict",
      owner: CASE_OWNER,
      text: `Alguma voz confirma o sanduíche? ${BLANK}`,
      accepted: ["ninguém", "nenhuma", "nenhum", "não"],
      secret: false,
      trigger: { kind: "start" },
    },
    {
      id: "princip-stranger",
      owner: "princip",
      text: `Um homem abordou Princip na esquina: ${BLANK}`,
      accepted: ["Pušara"],
      secret: true,
      trigger: { kind: "saidWord", terms: ["Pušara"] },
    },
  ],
  suggestions: [
    { characterId: "princip", text: "Onde você estava quando o carro parou?" },
    { characterId: "harrach", text: "Onde você estava no carro?" },
    { characterId: "albertini", text: "Essa história do sanduíche é verdade?" },
  ],
  closing: {
    text: "Nenhuma voz desta cena fala em sanduíche. No processo, Princip contou que esperava na esquina, diante de uma loja. Harrach contou que estava no estribo e que os tiros vieram do lado oposto. A menção mais antiga ao sanduíche que o projeto achou está num romance de 1998, décadas depois.",
    references: [
      "Pharos (ed.), Der Prozeß gegen die Attentäter von Sarajewo, 1918, pp. 30 e 158–159",
      "Jô Soares, O homem que matou Getúlio Vargas, 1998",
      "Mike Dash, 2011, sobre a origem da história do sanduíche",
    ],
  },
};
