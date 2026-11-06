import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { readSseDeltas } from "./sse";
import { type ChatProvider, type EmbeddingProvider, ProviderError, toProviderError } from "./types";

export const DEFAULT_OPENROUTER_CHAT_MODEL = "meta-llama/llama-3.3-70b-instruct";
export const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "baai/bge-m3";

export type OpenRouterConfig = {
  apiKey: string;
  accountId: string;
  gatewayId: string;
  gatewayToken?: string;
  chatModel?: string;
  embeddingModel?: string;
  fetcher?: typeof fetch;
};

export type OpenRouterProvider = ChatProvider & EmbeddingProvider;

export const openRouterGatewayUrl = (accountId: string, gatewayId: string) =>
  `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openrouter/v1`;

export const gatewayAuthHeaders = (token?: string): Record<string, string> =>
  token ? { "cf-aig-authorization": `Bearer ${token}` } : {};

export const createOpenRouterProvider = ({
  apiKey,
  accountId,
  gatewayId,
  gatewayToken,
  chatModel = DEFAULT_OPENROUTER_CHAT_MODEL,
  embeddingModel = DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  fetcher = (input, init) => fetch(input, init),
}: OpenRouterConfig): OpenRouterProvider => {
  if (!apiKey || !accountId || !gatewayId)
    throw new ProviderError({
      message: "openrouter: OPENROUTER_API_KEY, CLOUDFLARE_ACCOUNT_ID and AI_GATEWAY_ID are required",
    });
  const baseUrl = openRouterGatewayUrl(accountId, gatewayId);
  const post = (path: string, body: unknown) =>
    Effect.tryPromise({
      try: (signal) =>
        fetcher(`${baseUrl}${path}`, {
          method: "POST",
          signal,
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            ...gatewayAuthHeaders(gatewayToken),
          },
          body: JSON.stringify(body),
        }),
      catch: toProviderError(`openrouter: ${path}`),
    }).pipe(
      Effect.filterOrFail(
        (response) => response.ok,
        (response) => new ProviderError({ message: `openrouter: ${path} returned ${response.status}` }),
      ),
    );
  return {
    name: "openrouter",
    stream: (messages, { maxTokens = 512 } = {}) =>
      Stream.unwrap(
        post("/chat/completions", { model: chatModel, messages, stream: true, max_tokens: maxTokens }).pipe(
          Effect.flatMap(({ body }) =>
            body
              ? Effect.succeed(readSseDeltas(body))
              : Effect.fail(new ProviderError({ message: "openrouter: empty stream" })),
          ),
        ),
      ),
    embed: (texts) =>
      post("/embeddings", { model: embeddingModel, input: texts }).pipe(
        Effect.flatMap((response) =>
          Effect.tryPromise({
            try: () => response.json() as Promise<{ data?: { embedding: number[]; index?: number }[] }>,
            catch: toProviderError("openrouter: /embeddings"),
          }),
        ),
        Effect.flatMap(({ data }) =>
          Array.isArray(data)
            ? Effect.succeed(
                [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((item) => item.embedding),
              )
            : Effect.fail(new ProviderError({ message: "openrouter: embedding response without data" })),
        ),
      ),
  };
};
