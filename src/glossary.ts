export type GlossaryKind = "place" | "organization";

export type GlossaryEntry = {
  ptBr: string;
  original: string;
  kind: GlossaryKind;
  aliases?: readonly string[];
};

export const glossary: readonly GlossaryEntry[] = [
  { ptBr: "Ponte Latina", original: "Latinska ćuprija", kind: "place", aliases: ["Lateinerbrücke"] },
  { ptBr: "cais Appel", original: "Appelquai", kind: "place" },
  { ptBr: "rio Miljacka", original: "Miljacka", kind: "place" },
  { ptBr: "Konak", original: "Konak", kind: "place" },
  { ptBr: "rua Franz Joseph", original: "Franz-Josef-Straße", kind: "place" },
  { ptBr: "Ilidže", original: "Ilidže", kind: "place" },
  { ptBr: "Mão Negra", original: "Crna ruka", kind: "organization" },
  { ptBr: "Jovem Bósnia", original: "Mlada Bosna", kind: "organization" },
  { ptBr: "Defesa Nacional", original: "Narodna odbrana", kind: "organization", aliases: ["Narodna obrana"] },
];

export const namingRules = [
  "People: always keep the original name (e.g. Franz Ferdinand, Gavrilo Princip, Sophie Chotek). Never translate personal names.",
  "Places and organizations: use the usual pt-br name, with the original in parentheses on first mention (e.g. Ponte Latina (Latinska ćuprija), Mão Negra (Crna ruka)). When the passages use another spelling, still write the glossary forms.",
] as const;
