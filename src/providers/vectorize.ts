import { metadataToChunk } from "../corpus";
import type { RetrievalIndex } from "./types";

export type VectorMatch = { id: string; score: number; metadata?: Record<string, unknown> };

export interface VectorQueryable {
  query(
    vector: number[],
    options: { topK: number; filter: Record<string, unknown>; returnMetadata: "all" },
  ): Promise<{ matches: VectorMatch[] }>;
}

export const createVectorizeIndex = (index: VectorQueryable): RetrievalIndex => ({
  name: "vectorize",
  async search(vector, { characterId, topK }) {
    const { matches } = await index.query(vector, {
      topK,
      filter: { characterId: { $eq: characterId } },
      returnMetadata: "all",
    });
    return matches
      .map((match) => ({ ...metadataToChunk(match.id, match.metadata), score: match.score }))
      .filter((chunk) => chunk.characterId === characterId);
  },
});
