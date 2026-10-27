import type { Chunk } from "./providers/types";

export const CHUNK_FIELDS = [
  "id",
  "characterId",
  "sourceTitle",
  "author",
  "year",
  "license",
  "location",
  "url",
  "language",
  "passage",
] as const satisfies readonly (keyof Chunk)[];

export type ChunkMetadata = Omit<Chunk, "id">;

const REQUIRED_STRING_FIELDS = CHUNK_FIELDS.filter((field) => field !== "year" && field !== "url");

export const validateChunk = (value: unknown): string[] => {
  if (typeof value !== "object" || value === null) return ["chunk is not an object"];
  const record = value as Record<string, unknown>;
  const missing = REQUIRED_STRING_FIELDS.filter(
    (field) => typeof record[field] !== "string" || record[field] === "",
  ).map((field) => `missing or empty "${field}"`);
  const year =
    typeof record.year === "number" || typeof record.year === "string" ? [] : ['missing "year"'];
  const url = record.url === undefined || typeof record.url === "string" ? [] : ['"url" must be a string'];
  return [...missing, ...year, ...url];
};

export const chunkToMetadata = ({ id: _id, ...metadata }: Chunk): ChunkMetadata => ({
  ...metadata,
  url: metadata.url ?? "",
});

export const metadataToChunk = (id: string, metadata: Record<string, unknown> | undefined): Chunk => {
  const text = (key: string) => (typeof metadata?.[key] === "string" ? (metadata[key] as string) : "");
  const year = metadata?.year;
  return {
    id,
    characterId: text("characterId"),
    sourceTitle: text("sourceTitle"),
    author: text("author"),
    year: typeof year === "number" || typeof year === "string" ? year : "",
    license: text("license"),
    location: text("location"),
    url: text("url"),
    language: text("language"),
    passage: text("passage"),
  };
};
