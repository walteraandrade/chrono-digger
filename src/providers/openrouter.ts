import { extractDelta, readSseData } from "./sse";
import { type ChatProvider, type EmbeddingProvider, ProviderError } from "./types";

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
    throw new ProviderError("openrouter: OPENROUTER_API_KEY, CLOUDFLARE_ACCOUNT_ID and AI_GATEWAY_ID are required");
  const baseUrl = openRouterGatewayUrl(accountId, gatewayId);
  const post = async (path: string, body: unknown, signal?: AbortSignal) => {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: "POST",
      signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...gatewayAuthHeaders(gatewayToken),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new ProviderError(`openrouter: ${path} returned ${response.status}`);
    return response;
  };
  return {
    name: "openrouter",
    async *stream(messages, { maxTokens = 512, signal } = {}) {
      const response = await post(
        "/chat/completions",
        { model: chatModel, messages, stream: true, max_tokens: maxTokens },
        signal,
      );
      if (!response.body) throw new ProviderError("openrouter: empty stream");
      for await (const event of readSseData(response.body)) {
        signal?.throwIfAborted();
        const delta = extractDelta(event);
        if (delta) yield delta;
      }
    },
    async embed(texts) {
      const response = await post("/embeddings", { model: embeddingModel, input: texts });
      const json = (await response.json()) as { data?: { embedding: number[]; index?: number }[] };
      if (!Array.isArray(json.data)) throw new ProviderError("openrouter: embedding response without data");
      return [...json.data]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding);
    },
  };
};
