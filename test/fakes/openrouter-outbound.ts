import { hashEmbed } from "./hash-embed.ts";

export const FAKE_ACCOUNT_ID = "test-account";
export const FAKE_GATEWAY_ID = "test-gateway";
export const FAKE_OPENROUTER_KEY = "test-openrouter-key";
export const FAKE_GATEWAY_TOKEN = "test-gateway-token";

const BASE = `https://gateway.ai.cloudflare.com/v1/${FAKE_ACCOUNT_ID}/${FAKE_GATEWAY_ID}/openrouter/v1`;

const sse = (events: string[]) =>
  new Response(events.map((event) => `data: ${event}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });

export const fakeOpenRouterOutbound = async (request: Request): Promise<Response> => {
  if (request.headers.get("authorization") !== `Bearer ${FAKE_OPENROUTER_KEY}`)
    return new Response("unauthorized", { status: 401 });
  if (request.headers.get("cf-aig-authorization") !== `Bearer ${FAKE_GATEWAY_TOKEN}`)
    return new Response("gateway unauthorized", { status: 401 });
  const body = (await request.json()) as { model: string; input?: string[] };
  if (request.url === `${BASE}/embeddings`)
    return Response.json({
      data: (body.input ?? []).map((text, index) => ({ index, embedding: hashEmbed(text) })),
    });
  if (request.url === `${BASE}/chat/completions`)
    return sse([
      JSON.stringify({ choices: [{ delta: { content: `[openrouter ${body.model}` } }] }),
      JSON.stringify({ choices: [{ delta: { content: " via gateway]" } }] }),
      "[DONE]",
    ]);
  return new Response(`unexpected outbound ${request.url}`, { status: 404 });
};
