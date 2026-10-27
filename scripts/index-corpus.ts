import { parseArgs } from "node:util";
import { chunkToMetadata } from "../src/corpus.ts";
import { createOpenRouterProvider } from "../src/providers/openrouter.ts";
import type { Chunk, EmbeddingProvider } from "../src/providers/types.ts";
import { type AiRunner, createWorkersAiProvider } from "../src/providers/workers-ai.ts";
import { countByCharacter, loadCorpus } from "./corpus-loader.ts";

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    dir: { type: "string", default: "corpus" },
    batch: { type: "string", default: "20" },
  },
});

const env = process.env;

const required = (name: string) => {
  const value = env[name];
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
};

const cloudflareHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

const restAiRunner = (accountId: string, token: string, gatewayId?: string): AiRunner => ({
  async run(model, inputs) {
    const url = gatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: cloudflareHeaders(token),
      body: JSON.stringify(inputs),
    });
    if (!response.ok) throw new Error(`workers-ai ${model}: ${response.status} ${await response.text()}`);
    const json = (await response.json()) as { result?: unknown };
    return json.result ?? json;
  },
});

const selectEmbeddingProvider = (): EmbeddingProvider => {
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const gatewayId = env.AI_GATEWAY_ID || undefined;
  const provider = env.EMBEDDING_PROVIDER || "workers-ai";
  if (provider === "workers-ai")
    return createWorkersAiProvider({
      ai: restAiRunner(accountId, required("CLOUDFLARE_API_TOKEN"), gatewayId),
      embeddingModel: env.WORKERS_AI_EMBEDDING_MODEL || undefined,
    });
  if (provider === "openrouter")
    return createOpenRouterProvider({
      apiKey: required("OPENROUTER_API_KEY"),
      accountId,
      gatewayId: required("AI_GATEWAY_ID"),
      embeddingModel: env.OPENROUTER_EMBEDDING_MODEL || undefined,
    });
  throw new Error(`unknown EMBEDDING_PROVIDER "${provider}"`);
};

const upsert = async (vectors: { id: string; values: number[]; metadata: object }[]) => {
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const indexName = env.VECTORIZE_INDEX || "chrono-digger-corpus";
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/upsert`,
    {
      method: "POST",
      headers: { ...cloudflareHeaders(required("CLOUDFLARE_API_TOKEN")), "content-type": "application/x-ndjson" },
      body: vectors.map((vector) => JSON.stringify(vector)).join("\n"),
    },
  );
  if (!response.ok) throw new Error(`vectorize upsert: ${response.status} ${await response.text()}`);
};

const batches = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

const indexBatch = async (embeddings: EmbeddingProvider, chunks: Chunk[]) => {
  const vectors = await embeddings.embed(chunks.map((chunk) => chunk.passage));
  if (vectors.length !== chunks.length) throw new Error(`expected ${chunks.length} vectors, got ${vectors.length}`);
  await upsert(
    chunks.map((chunk, index) => ({ id: chunk.id, values: vectors[index] ?? [], metadata: chunkToMetadata(chunk) })),
  );
};

const main = async () => {
  const corpus = await loadCorpus(args.dir);
  console.log(`files: ${corpus.files.join(", ") || "(none)"}`);
  console.log(`chunks: ${corpus.chunks.length}`, countByCharacter(corpus.chunks));
  if (corpus.errors.length > 0) {
    corpus.errors.forEach((error) => console.error(`invalid: ${error}`));
    process.exit(1);
  }
  if (args["dry-run"]) return console.log("dry run: corpus is valid, nothing uploaded");
  const embeddings = selectEmbeddingProvider();
  const size = Math.max(1, Number.parseInt(args.batch, 10) || 20);
  for (const [index, batch] of batches(corpus.chunks, size).entries()) {
    await indexBatch(embeddings, batch);
    console.log(`upserted batch ${index + 1} (${batch.length} chunks) with ${embeddings.name}`);
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
