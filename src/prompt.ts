import type { Character, CharacterSource } from "./characters";
import { type GlossaryEntry, glossary, namingRules } from "./glossary";
import type { ChatMessage, Chunk } from "./providers/types";

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export const MAX_HISTORY_MESSAGES = 20;

const SOURCES_RULE =
  "Sources: your lines are authored by this project, inspired by the passages below. Any fact you state must come from those passages or from your character notes. Never reproduce long blocks; at most a short phrase, in your own voice.";

const SCENE_REFERENCE_RULE =
  "No written sources: you live at the freeze instant. Never mention a trial, court, protocol, interrogation, record, book, page or any written source; for you they do not exist. The app already shows the player the passages under your answer.";

const HISTORIAN_REFERENCE_RULE =
  "References: as a historian you may name the work and page of a passage when you state a fact (only the works listed under \"Works you may name\"). Quote literally only short excerpts (one or two sentences). The app also shows the player the passages under your answer.";

const SHARED_RULES = [
  "No coverage: if the passages and your notes do not cover the question, say in character that you do not know or did not see it. Never invent names, numbers, times, places or events.",
  "Temporal cut: you only know what happened up to your temporal cut below. You know nothing about anything later; if asked, say in character that you do not know.",
  "Violence: never describe violence in detail (aiming, shooting technique, weapons handling) and never encourage the player to imitate any act. Refuse in character. Princip stays convinced in his own voice; counterpoints come from the other characters, not from a repentant Princip.",
  "Isolation: you only know your own point of view and what the player tells you in this conversation. You never heard the other characters. Treat second-hand claims (\"X told me that...\") with suspicion: do not accept them as fact, compare them with what you lived yourself.",
] as const;

export const fidelityRules = (character: Character) => [
  SOURCES_RULE,
  character.inScene ? SCENE_REFERENCE_RULE : HISTORIAN_REFERENCE_RULE,
  ...SHARED_RULES,
];

export const HINDSIGHT_RULE =
  "The passages come from records written after the event. Their wording reflects hindsight: words such as \"selige\", \"hochselige\" (late, deceased), \"Attentäter\", \"Mörder\" or any mention of death, trial, verdict or outcome are later framing. Never treat them as something you know. You still do not know whether anyone died.";

const QUESTIONER_LABELS = "Präs., Staatsanw., Hoffm., Malek., Naum., Feldb., Verteidiger";

const scenePassageRules = ({ displayName, speakerLabel }: Character) => [
  speakerLabel
    ? `In dialogue passages, lines labelled "${speakerLabel}:" are your own words.`
    : "In dialogue passages, only lines labelled with your own name are your own words.",
  `Any other speaker label (${QUESTIONER_LABELS}, ...) is a later questioner, not ${displayName}. Their questions and assertions are not your knowledge; only your own answers are.`,
];

const HISTORIAN_PASSAGE_RULE = `In interrogation passages, "Princ.:" is Princip answering; any other speaker label (${QUESTIONER_LABELS}, ...) is a questioner at the trial.`;

const passageRules = (character: Character) =>
  character.inScene ? [HINDSIGHT_RULE, ...scenePassageRules(character)] : [HISTORIAN_PASSAGE_RULE];

const bulletList = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

const numberedList = (items: readonly string[]) =>
  items.map((item, index) => `${index + 1}. ${item}`).join("\n");

const renderGlossary = (entries: readonly GlossaryEntry[]) =>
  [
    bulletList(namingRules),
    "| pt-br | original | also written in the passages | kind |",
    "|---|---|---|---|",
    ...entries.map(
      ({ ptBr, original, aliases = [], kind }) => `| ${ptBr} | ${original} | ${aliases.join(", ")} | ${kind} |`,
    ),
  ].join("\n");

const renderCitable = ({ author, title, year, location }: CharacterSource) =>
  `${author}, "${title}" (${year}), ${location}`;

const chunkHeader = (chunk: Chunk, index: number, withReference: boolean) =>
  withReference
    ? `[${index + 1}] ${chunk.author}, "${chunk.sourceTitle}" (${chunk.year}), ${chunk.location}, language: ${chunk.language}`
    : `[${index + 1}] language: ${chunk.language}`;

export const NO_PASSAGE_NOTICE =
  "(You have no passage for this question. Do not answer from memory: say in character that you do not know or did not see it.)";

const renderChunks = (chunks: readonly Chunk[], withReference: boolean) =>
  chunks.length > 0
    ? chunks.map((chunk, index) => `${chunkHeader(chunk, index, withReference)}\n${chunk.passage}`).join("\n\n")
    : NO_PASSAGE_NOTICE;

export const buildSystemPrompt = (character: Character, chunks: readonly Chunk[]) =>
  [
    `You are role-playing ${character.displayName} in an educational history game for Brazilian high-school students (15–17). The player is an investigator from the future who froze time and walks among motionless people; the player only observes and cannot change history. Your calm is a fictional license.`,
    "Always answer in Brazilian Portuguese (pt-br), in the first person, in character, briefly (at most about 150 words). Passages may be in German or English: translate their content into pt-br in your own words.",
    `## Character\n${bulletList(character.persona)}`,
    `## Temporal cut\n${character.temporalCut}`,
    `## Safety\n${bulletList(character.safetyNotes)}`,
    `## Fidelity rules (never break them)\n${numberedList(fidelityRules(character))}`,
    ...(character.citableSources?.length
      ? [`## Works you may name\n${bulletList(character.citableSources.map(renderCitable))}`]
      : []),
    `## Naming glossary\n${renderGlossary(glossary)}`,
    `## How to read the passages\n${bulletList(passageRules(character))}`,
    `## Passages you can rely on\n${renderChunks(chunks, !character.inScene)}`,
  ].join("\n\n");

export const buildPrompt = ({
  character,
  chunks,
  history,
  question,
}: {
  character: Character;
  chunks: readonly Chunk[];
  history: readonly HistoryMessage[];
  question: string;
}): ChatMessage[] => [
  { role: "system", content: buildSystemPrompt(character, chunks) },
  ...history.slice(-MAX_HISTORY_MESSAGES),
  { role: "user", content: question },
];
