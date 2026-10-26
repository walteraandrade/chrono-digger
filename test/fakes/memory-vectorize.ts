import { chunkToMetadata } from "../../src/corpus";
import type { Chunk } from "../../src/providers/types";
import type { VectorMatch, VectorQueryable } from "../../src/providers/vectorize";

type StoredVector = { id: string; values: number[]; metadata: Record<string, unknown> };

const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 0 : dot / denominator;
};

const matchesFilter = (metadata: Record<string, unknown>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, condition]) =>
    typeof condition === "object" && condition !== null && "$eq" in condition
      ? metadata[key] === (condition as { $eq: unknown }).$eq
      : metadata[key] === condition,
  );

export const createMemoryVectorize = (
  chunks: readonly Chunk[],
  embed: (text: string) => number[],
): VectorQueryable => {
  const stored: StoredVector[] = chunks.map((chunk) => ({
    id: chunk.id,
    values: embed(chunk.passage),
    metadata: chunkToMetadata(chunk),
  }));
  return {
    async query(vector, { topK, filter }) {
      const matches: VectorMatch[] = stored
        .filter((item) => matchesFilter(item.metadata, filter))
        .map((item) => ({ id: item.id, score: cosine(vector, item.values), metadata: item.metadata }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      return { matches };
    },
  };
};
