import * as Data from "effect/Data";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type ChatOptions = { maxTokens?: number; temperature?: number };

export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const toProviderError =
  (context: string) =>
  (cause: unknown): ProviderError =>
    cause instanceof ProviderError ? cause : new ProviderError({ message: `${context}: ${String(cause)}`, cause });

export interface ChatProvider {
  readonly name: string;
  stream(messages: ChatMessage[], options?: ChatOptions): Stream.Stream<string, ProviderError>;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Effect.Effect<number[][], ProviderError>;
}

export type Chunk = {
  id: string;
  characterId: string;
  sourceTitle: string;
  author: string;
  year: number | string;
  license: string;
  location: string;
  url: string;
  language: string;
  passage: string;
};

export type Source = Omit<Chunk, "characterId">;

export type ScoredChunk = Chunk & { score: number };

export type SearchOptions = { characterId: string; topK: number };

export interface RetrievalIndex {
  readonly name: string;
  search(vector: number[], options: SearchOptions): Effect.Effect<ScoredChunk[], ProviderError>;
}
