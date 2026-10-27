import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import {
  FAKE_ACCOUNT_ID,
  FAKE_GATEWAY_ID,
  FAKE_GATEWAY_TOKEN,
  FAKE_OPENROUTER_KEY,
  fakeOpenRouterOutbound,
} from "./test/fakes/openrouter-outbound.ts";
import {
  TEST_ACCESS_CODE,
  TEST_DAILY_LIMIT,
  TEST_GLOBAL_DAILY_LIMIT,
  TEST_TURN_TIMEOUT_MS,
} from "./test/constants.ts";

const COMPATIBILITY_DATE = "2026-08-01";

const durableObjects = {
  CHARACTER_SESSION: { className: "CharacterSession", useSQLite: true },
  PLAYER_QUOTA: { className: "PlayerQuota", useSQLite: true },
  GLOBAL_QUOTA: { className: "GlobalQuota", useSQLite: true },
};

const FAKE_PROVIDERS = { CHAT_PROVIDER: "fake", EMBEDDING_PROVIDER: "fake", RETRIEVAL_INDEX: "memory" };

const project = (name: string, bindings: Record<string, string>, miniflare: Record<string, unknown> = {}) => ({
  plugins: [
    cloudflareTest({
      main: "./test/worker.ts",
      remoteBindings: false,
      miniflare: {
        compatibilityDate: COMPATIBILITY_DATE,
        durableObjects,
        bindings: {
          ACCESS_CODE: TEST_ACCESS_CODE,
          DAILY_LIMIT: String(TEST_DAILY_LIMIT),
          GLOBAL_DAILY_LIMIT: "100000",
          TURN_TIMEOUT_MS: String(TEST_TURN_TIMEOUT_MS),
          ...bindings,
        },
        ...miniflare,
      },
    }),
  ],
  test: { name, include: [`test/${name}/**/*.test.ts`] },
});

export default defineConfig({
  test: {
    projects: [
      { test: { name: "corpus", include: ["scripts/**/*.test.ts"], environment: "node" } },
      project("seam", FAKE_PROVIDERS),
      project("global-quota", { ...FAKE_PROVIDERS, GLOBAL_DAILY_LIMIT: String(TEST_GLOBAL_DAILY_LIMIT) }),
      project(
        "openrouter",
        {
          CHAT_PROVIDER: "openrouter",
          EMBEDDING_PROVIDER: "openrouter",
          RETRIEVAL_INDEX: "memory",
          OPENROUTER_API_KEY: FAKE_OPENROUTER_KEY,
          CLOUDFLARE_ACCOUNT_ID: FAKE_ACCOUNT_ID,
          AI_GATEWAY_ID: FAKE_GATEWAY_ID,
          AI_GATEWAY_TOKEN: FAKE_GATEWAY_TOKEN,
        },
        { outboundService: fakeOpenRouterOutbound },
      ),
      project(
        "workers-ai",
        { RETRIEVAL_INDEX: "memory", AI_GATEWAY_ID: FAKE_GATEWAY_ID },
        {
          serviceBindings: { AI: { name: "fake-ai", entrypoint: "FakeAi" } },
          workers: [
            {
              name: "fake-ai",
              modules: true,
              scriptPath: "./test/fixtures/fake-ai-worker.js",
              compatibilityDate: COMPATIBILITY_DATE,
            },
          ],
        },
      ),
    ],
  },
});
