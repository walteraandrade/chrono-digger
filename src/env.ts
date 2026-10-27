import type { GlobalQuota, PlayerQuota } from "./quota";

export interface Env {
  ACCESS_CODE: string;
  DAILY_LIMIT?: string;
  GLOBAL_DAILY_LIMIT?: string;
  MIN_SOURCE_SCORE?: string;
  TURN_TIMEOUT_MS?: string;
  CHAT_PROVIDER?: string;
  EMBEDDING_PROVIDER?: string;
  RETRIEVAL_INDEX?: string;
  AI_GATEWAY_ID?: string;
  AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  WORKERS_AI_CHAT_MODEL?: string;
  WORKERS_AI_EMBEDDING_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_CHAT_MODEL?: string;
  OPENROUTER_EMBEDDING_MODEL?: string;
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;
  CHARACTER_SESSION: DurableObjectNamespace;
  PLAYER_QUOTA: DurableObjectNamespace<PlayerQuota>;
  GLOBAL_QUOTA: DurableObjectNamespace<GlobalQuota>;
  ASSETS?: Fetcher;
}
