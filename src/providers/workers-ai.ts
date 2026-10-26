import { extractDelta, readSseData } from "./sse";
import { type ChatProvider, type EmbeddingProvider, ProviderError } from "./types";

export const DEFAULT_WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = "@cf/baai/bge-m3";

export type AiRunOptions = { gateway?: { id: string } };

export interface AiRunner {
  run(model: string, inputs: Record<string, unknown>, options?: AiRunOptions): Promise<unknown>;
}

export type WorkersAiConfig = {
  ai: AiRunner;
  gatewayId?: string;
  chatModel?: string;
  embeddingModel?: string;
};

export type WorkersAiProvider = ChatProvider & EmbeddingProvider;

const isReadableStream = (value: unknown): value is ReadableStream<Uint8Array> =>
  typeof value === "object" && value !== null && "getReader" in value;

const toEmbeddings = (result: unknown): number[][] => {
  const data = (result as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new ProviderError("workers-ai: embedding response without data");
  return data as number[][];
};

export const createWorkersAiProvider = ({
  ai,
  gatewayId,
  chatModel = DEFAULT_WORKERS_AI_CHAT_MODEL,
  embeddingModel = DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
}: WorkersAiConfig): WorkersAiProvider => {
  const options: AiRunOptions = gatewayId ? { gateway: { id: gatewayId } } : {};
  return {
    name: "workers-ai",
    async *stream(messages, { maxTokens = 512, signal } = {}) {
      const result = await ai.run(chatModel, { messages, stream: true, max_tokens: maxTokens }, options);
      if (!isReadableStream(result)) throw new ProviderError("workers-ai: expected a stream");
      for await (const event of readSseData(result)) {
        signal?.throwIfAborted();
        const delta = extractDelta(event);
        if (delta) yield delta;
      }
    },
    async embed(texts) {
      return toEmbeddings(await ai.run(embeddingModel, { text: texts }, options));
    },
  };
};
