import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { ProviderError, toProviderError } from "./types";

const IDLE_TIMEOUT_MS = 30_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseEvent = (data: string) =>
  Effect.try({ try: () => JSON.parse(data) as unknown, catch: toProviderError("sse: invalid event") });

const extractDelta = (event: unknown): Effect.Effect<string, ProviderError> => {
  if (!isRecord(event)) return Effect.succeed("");
  if (isRecord(event.error))
    return Effect.fail(new ProviderError({ message: String(event.error.message ?? "provider stream error") }));
  if (typeof event.response === "string") return Effect.succeed(event.response);
  const choice = Array.isArray(event.choices) ? event.choices[0] : undefined;
  return Effect.succeed(
    isRecord(choice) && isRecord(choice.delta) && typeof choice.delta.content === "string" ? choice.delta.content : "",
  );
};

export const readSseDeltas = (
  stream: ReadableStream<Uint8Array>,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
): Stream.Stream<string, ProviderError> =>
  Stream.fromReadableStream({ evaluate: () => stream, onError: toProviderError("sse: read failed") }).pipe(
    Stream.timeoutOrElse({
      duration: idleTimeoutMs,
      orElse: () => Stream.fail(new ProviderError({ message: `stream idle for ${idleTimeoutMs}ms` })),
    }),
    Stream.decodeText(),
    Stream.splitLines,
    Stream.filter((line) => line.startsWith("data:")),
    Stream.map((line) => line.slice(5).trim()),
    Stream.filter((data) => data !== ""),
    Stream.takeWhile((data) => data !== "[DONE]"),
    Stream.mapEffect((data) => parseEvent(data).pipe(Effect.flatMap(extractDelta))),
    Stream.filter((delta) => delta !== ""),
  );
