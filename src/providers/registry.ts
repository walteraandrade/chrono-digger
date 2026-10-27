import type { Env } from "../env";
import { createOpenRouterProvider } from "./openrouter";
import { type ChatProvider, type EmbeddingProvider, ProviderError, type RetrievalIndex } from "./types";
import { type VectorQueryable, createVectorizeIndex } from "./vectorize";
import { type AiRunner, createWorkersAiProvider } from "./workers-ai";

type Factory<T> = (env: Env) => T;

export type ProviderRegistry = {
  chat: Record<string, Factory<ChatProvider>>;
  embeddings: Record<string, Factory<EmbeddingProvider>>;
  index: Record<string, Factory<RetrievalIndex>>;
};

export type Providers = {
  chat: ChatProvider;
  embeddings: EmbeddingProvider;
  index: RetrievalIndex;
};

export const DEFAULT_CHAT_PROVIDER = "workers-ai";
export const DEFAULT_EMBEDDING_PROVIDER = "workers-ai";
export const DEFAULT_RETRIEVAL_INDEX = "vectorize";

const requireBinding = <T>(binding: T | undefined, name: string): T => {
  if (!binding) throw new ProviderError(`missing binding ${name}`);
  return binding;
};

const workersAi = (env: Env) =>
  createWorkersAiProvider({
    ai: requireBinding(env.AI, "AI") as unknown as AiRunner,
    gatewayId: env.AI_GATEWAY_ID,
    chatModel: env.WORKERS_AI_CHAT_MODEL || undefined,
    embeddingModel: env.WORKERS_AI_EMBEDDING_MODEL || undefined,
  });

const openRouter = (env: Env) =>
  createOpenRouterProvider({
    apiKey: env.OPENROUTER_API_KEY ?? "",
    accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
    gatewayId: env.AI_GATEWAY_ID ?? "",
    chatModel: env.OPENROUTER_CHAT_MODEL || undefined,
    embeddingModel: env.OPENROUTER_EMBEDDING_MODEL || undefined,
  });

export const defaultRegistry: ProviderRegistry = {
  chat: { "workers-ai": workersAi, openrouter: openRouter },
  embeddings: { "workers-ai": workersAi, openrouter: openRouter },
  index: {
    vectorize: (env) =>
      createVectorizeIndex(requireBinding(env.VECTORIZE, "VECTORIZE") as unknown as VectorQueryable),
  },
};

const pick = <T>(factories: Record<string, Factory<T>>, key: string, kind: string, env: Env): T => {
  const factory = factories[key];
  if (!factory) throw new ProviderError(`unknown ${kind} "${key}"`);
  return factory(env);
};

export const selectProviders = (registry: ProviderRegistry, env: Env): Providers => ({
  chat: pick(registry.chat, env.CHAT_PROVIDER || DEFAULT_CHAT_PROVIDER, "chat provider", env),
  embeddings: pick(
    registry.embeddings,
    env.EMBEDDING_PROVIDER || DEFAULT_EMBEDDING_PROVIDER,
    "embedding provider",
    env,
  ),
  index: pick(registry.index, env.RETRIEVAL_INDEX || DEFAULT_RETRIEVAL_INDEX, "retrieval index", env),
});
