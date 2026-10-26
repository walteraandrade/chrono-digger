const IDLE_TIMEOUT_MS = 30_000;

const readWithTimeout = <T>(reader: ReadableStreamDefaultReader<T>, ms: number) =>
  new Promise<ReadableStreamReadResult<T>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`stream idle for ${ms}ms`)), ms);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export async function* readLines(
  stream: ReadableStream<Uint8Array>,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await readWithTimeout(reader, idleTimeoutMs);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      yield* lines;
    }
    buffer += decoder.decode();
    if (buffer) yield buffer;
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

export async function* readSseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  for await (const line of readLines(stream)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") return;
    yield JSON.parse(data) as unknown;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const extractDelta = (event: unknown): string => {
  if (!isRecord(event)) return "";
  if (isRecord(event.error)) throw new Error(String(event.error.message ?? "provider stream error"));
  if (typeof event.response === "string") return event.response;
  const choice = Array.isArray(event.choices) ? event.choices[0] : undefined;
  if (isRecord(choice) && isRecord(choice.delta) && typeof choice.delta.content === "string")
    return choice.delta.content;
  return "";
};
