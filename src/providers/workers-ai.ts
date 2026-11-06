import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { readSseDeltas } from "./sse";
import { type ChatProvider, type EmbeddingProvider, ProviderError, toProviderError } from "./types";

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

const toEmbeddings = (result: unknown): Effect.Effect<number[][], ProviderError> => {
  const data = (result as { data?: unknown } | null)?.data;
  return Array.isArray(data)
    ? Effect.succeed(data as number[][])
    : Effect.fail(new ProviderError({ message: "workers-ai: embedding response without data" }));
};

export const createWorkersAiProvider = ({
  ai,
  gatewayId,
  chatModel = DEFAULT_WORKERS_AI_CHAT_MODEL,
  embeddingModel = DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
}: WorkersAiConfig): WorkersAiProvider => {
  const options: AiRunOptions = gatewayId ? { gateway: { id: gatewayId } } : {};
  const run = (model: string, inputs: Record<string, unknown>) =>
    Effect.tryPromise({ try: () => ai.run(model, inputs, options), catch: toProviderError(`workers-ai: ${model}`) });
  return {
    name: "workers-ai",
    stream: (messages, { maxTokens = 512, temperature } = {}) =>
      Stream.unwrap(
        run(chatModel, { messages, stream: true, max_tokens: maxTokens, temperature }).pipe(
          Effect.flatMap((result) =>
            isReadableStream(result)
              ? Effect.succeed(readSseDeltas(result))
              : Effect.fail(new ProviderError({ message: "workers-ai: expected a stream" })),
          ),
        ),
      ),
    embed: (texts) => run(embeddingModel, { text: texts }).pipe(Effect.flatMap(toEmbeddings)),
  };
};
