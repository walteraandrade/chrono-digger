import { WorkerEntrypoint } from "cloudflare:workers";

const EMBEDDING_MODEL = "@cf/baai/bge-m3";

const sse = (events) =>
  new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      events.forEach((event) => controller.enqueue(encoder.encode(`data: ${event}\n\n`)));
      controller.close();
    },
  });

export class FakeAi extends WorkerEntrypoint {
  async run(model, inputs, options) {
    const gateway = options?.gateway?.id ?? "none";
    if (Array.isArray(inputs.text)) {
      if (model !== EMBEDDING_MODEL) throw new Error(`unexpected embedding model ${model}`);
      return { shape: [inputs.text.length, 3], data: inputs.text.map(() => [1, 0, 0]) };
    }
    if (!inputs.stream) throw new Error("expected stream: true");
    return sse([
      JSON.stringify({ response: `[workers-ai ${model}` }),
      JSON.stringify({ response: ` gateway=${gateway}]` }),
      "[DONE]",
    ]);
  }
}

export default { fetch: () => new Response("fake ai") };
