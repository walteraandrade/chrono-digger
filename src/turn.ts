import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import type { Character } from "./characters";
import { type HistoryMessage, buildPrompt } from "./prompt";
import type { Providers } from "./providers/registry";
import { type Chunk, ProviderError } from "./providers/types";

export const TOP_K = 4;
export const DEFAULT_MIN_SOURCE_SCORE = 0.45;
export const DEFAULT_TURN_TIMEOUT_MS = 45_000;

export type Source = Omit<Chunk, "characterId">;

export type TurnResult = { answer: string; sources: Source[] };

const toSource = ({ characterId: _characterId, ...source }: Chunk): Source => source;

export const parseMinSourceScore = (value: string | undefined) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_SOURCE_SCORE;
};

export const parseTurnTimeoutMs = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TURN_TIMEOUT_MS;
};

export const runCharacterTurn = ({
  character,
  question,
  history,
  providers: { chat, embeddings, index },
  minScore,
  timeoutMs,
  onChunk,
}: {
  character: Character;
  question: string;
  history: readonly HistoryMessage[];
  providers: Providers;
  minScore: number;
  timeoutMs: number;
  onChunk: (text: string) => void;
}): Effect.Effect<TurnResult, ProviderError> =>
  Effect.gen(function* () {
    const [vector] = yield* embeddings.embed([question]);
    if (!vector) return yield* new ProviderError({ message: `${embeddings.name}: no embedding returned` });
    const scored = yield* index.search(vector, { characterId: character.id, topK: TOP_K });
    const chunks = scored.filter(({ score }) => score >= minScore).map(({ score: _score, ...chunk }) => chunk);
    const messages = buildPrompt({ character, chunks, history, question });
    const answer = yield* chat.stream(messages).pipe(
      Stream.tap((piece) => Effect.sync(() => onChunk(piece))),
      Stream.runFold(
        () => "",
        (text, piece) => text + piece,
      ),
    );
    if (!answer.trim()) return yield* new ProviderError({ message: `${chat.name}: empty answer` });
    return { answer, sources: chunks.map(toSource) };
  }).pipe(
    Effect.timeoutOrElse({
      duration: timeoutMs,
      orElse: () => Effect.fail(new ProviderError({ message: `turn exceeded ${timeoutMs}ms` })),
    }),
  );
