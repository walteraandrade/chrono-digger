export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

export type ChatOptions = { maxTokens?: number; signal?: AbortSignal };

export interface ChatProvider {
  readonly name: string;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
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

export type ScoredChunk = Chunk & { score: number };

export type SearchOptions = { characterId: string; topK: number };

export interface RetrievalIndex {
  readonly name: string;
  search(vector: number[], options: SearchOptions): Promise<ScoredChunk[]>;
}

export class ProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
  }
}
