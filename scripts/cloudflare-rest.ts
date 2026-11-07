import { gatewayAuthHeaders } from "../src/providers/openrouter.ts";
import type { AiRunner } from "../src/providers/workers-ai.ts";

const REQUEST_TIMEOUT_MS = 120_000;

export type RestAiConfig = {
  accountId: string;
  token: string;
  gatewayId?: string;
  gatewayToken?: string;
  fetcher?: typeof fetch;
};

export const cloudflareHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

export const restAiRunner = ({
  accountId,
  token,
  gatewayId,
  gatewayToken,
  fetcher = (input, init) => fetch(input, init),
}: RestAiConfig): AiRunner => ({
  async run(model, inputs) {
    const url = gatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetcher(url, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { ...cloudflareHeaders(token), ...(gatewayId ? gatewayAuthHeaders(gatewayToken) : {}) },
      body: JSON.stringify(inputs),
    });
    if (!response.ok) throw new Error(`workers-ai ${model}: ${response.status} ${await response.text()}`);
    if (inputs.stream) return response.body;
    const json = (await response.json()) as { result?: unknown };
    return json.result ?? json;
  },
});
