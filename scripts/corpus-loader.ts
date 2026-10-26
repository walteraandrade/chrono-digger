import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { characters } from "../src/characters.ts";
import { chunkToMetadata, validateChunk } from "../src/corpus.ts";
import type { Chunk } from "../src/providers/types.ts";

export const MAX_VECTOR_ID_BYTES = 64;
export const MAX_METADATA_BYTES = 10 * 1024;

export type LoadedCorpus = { files: string[]; chunks: Chunk[]; errors: string[] };

const knownCharacters = new Set(characters.map((character) => character.id));

const byteLength = (value: string) => new TextEncoder().encode(value).length;

const chunkErrors = (value: unknown): string[] => {
  const shape = validateChunk(value);
  if (shape.length > 0) return shape;
  const chunk = value as Chunk;
  return [
    ...(knownCharacters.has(chunk.characterId) ? [] : [`unknown characterId "${chunk.characterId}"`]),
    ...(byteLength(chunk.id) <= MAX_VECTOR_ID_BYTES ? [] : [`id longer than ${MAX_VECTOR_ID_BYTES} bytes`]),
    ...(byteLength(JSON.stringify(chunkToMetadata(chunk))) <= MAX_METADATA_BYTES
      ? []
      : [`metadata larger than ${MAX_METADATA_BYTES} bytes`]),
  ];
};

type LoadedFile = { chunks: Chunk[]; ids: string[]; errors: string[] };

const idOf = (value: unknown) =>
  typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string"
    ? (value as { id: string }).id
    : undefined;

const loadFile = async (path: string): Promise<LoadedFile> => {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) return { chunks: [], ids: [], errors: [`${path}: expected a JSON array of chunks`] };
  const errors = parsed.flatMap((value, index) =>
    chunkErrors(value).map((error) => `${path} [${index}] ${idOf(value) ?? "?"}: ${error}`),
  );
  const ids = parsed.map(idOf).filter((id): id is string => id !== undefined);
  return { chunks: errors.length === 0 ? (parsed as Chunk[]) : [], ids, errors };
};

export const loadCorpus = async (dir: string): Promise<LoadedCorpus> => {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort().map((name) => join(dir, name));
  const loaded = await Promise.all(files.map(loadFile));
  const chunks = loaded.flatMap((file) => file.chunks);
  const seen = loaded
    .flatMap((file) => file.ids)
    .reduce((counts, id) => counts.set(id, (counts.get(id) ?? 0) + 1), new Map<string, number>());
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([id]) => `duplicate chunk id "${id}"`);
  return { files, chunks, errors: [...loaded.flatMap((file) => file.errors), ...duplicates] };
};

export const countByCharacter = (chunks: readonly Chunk[]) =>
  chunks.reduce<Record<string, number>>(
    (counts, chunk) => ({ ...counts, [chunk.characterId]: (counts[chunk.characterId] ?? 0) + 1 }),
    {},
  );
