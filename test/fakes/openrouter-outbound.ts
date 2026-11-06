import { hashEmbed } from "./hash-embed.ts";

export const FAKE_ACCOUNT_ID = "test-account";
export const FAKE_GATEWAY_ID = "test-gateway";
export const FAKE_OPENROUTER_KEY = "test-openrouter-key";
export const FAKE_GATEWAY_TOKEN = "test-gateway-token";

export const SPLIT_SSE_TRIGGER = "[split-sse]";
export const STREAM_ERROR_TRIGGER = "[stream-error]";
export const BAD_JSON_TRIGGER = "[bad-json]";
export const HUNG_STREAM_TRIGGER = "[hung-stream]";
export const BAD_STATUS_TRIGGER = "[bad-status]";

const BASE = `https://gateway.ai.cloudflare.com/v1/${FAKE_ACCOUNT_ID}/${FAKE_GATEWAY_ID}/openrouter/v1`;

const sse = (events: string[]) =>
  new Response(events.map((event) => `data: ${event}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });

const delta = (content: string) => JSON.stringify({ choices: [{ delta: { content } }] });

const streamOf = (pieces: string[], { hang = false } = {}) => {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
        if (!hang) controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
};

const splitSse = () => {
  const encoded = `data: ${delta("Olá, ")}\r\n\r\ndata: ${delta("mundo")}`;
  const middle = Math.floor(encoded.length / 2);
  return streamOf([encoded.slice(0, middle), encoded.slice(middle)]);
};

const scriptedChat = (question: string) => {
  if (question.includes(SPLIT_SSE_TRIGGER)) return splitSse();
  if (question.includes(STREAM_ERROR_TRIGGER))
    return streamOf([`data: ${delta("parcial")}\n\ndata: ${JSON.stringify({ error: { message: "boom" } })}\n\n`]);
  if (question.includes(BAD_JSON_TRIGGER)) return streamOf([`data: ${delta("parcial")}\n\ndata: {oops\n\n`]);
  if (question.includes(HUNG_STREAM_TRIGGER)) return streamOf([`data: ${delta("parcial")}\n\n`], { hang: true });
  if (question.includes(BAD_STATUS_TRIGGER)) return new Response("upstream down", { status: 502 });
  return undefined;
};

export const fakeOpenRouterOutbound = async (request: Request): Promise<Response> => {
  if (request.headers.get("authorization") !== `Bearer ${FAKE_OPENROUTER_KEY}`)
    return new Response("unauthorized", { status: 401 });
  if (request.headers.get("cf-aig-authorization") !== `Bearer ${FAKE_GATEWAY_TOKEN}`)
    return new Response("gateway unauthorized", { status: 401 });
  const body = (await request.json()) as {
    model: string;
    input?: string[];
    messages?: { role: string; content: string }[];
  };
  if (request.url === `${BASE}/embeddings`)
    return Response.json({
      data: (body.input ?? []).map((text, index) => ({ index, embedding: hashEmbed(text) })),
    });
  if (request.url === `${BASE}/chat/completions`)
    return scriptedChat(body.messages?.at(-1)?.content ?? "") ?? sse([
      delta(`[openrouter ${body.model}`),
      delta(" via gateway]"),
      "[DONE]",
    ]);
  return new Response(`unexpected outbound ${request.url}`, { status: 404 });
};
