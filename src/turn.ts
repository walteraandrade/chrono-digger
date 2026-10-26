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

const withDeadline = <T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new ProviderError(`turn exceeded ${timeoutMs}ms`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const work = run(controller.signal);
  work.catch(() => undefined);
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
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
}): Promise<TurnResult> =>
  withDeadline(timeoutMs, async (signal) => {
    const [vector] = await embeddings.embed([question]);
    signal.throwIfAborted();
    if (!vector) throw new ProviderError(`${embeddings.name}: no embedding returned`);
    const scored = await index.search(vector, { characterId: character.id, topK: TOP_K });
    signal.throwIfAborted();
    const chunks = scored.filter(({ score }) => score >= minScore).map(({ score: _score, ...chunk }) => chunk);
    const messages = buildPrompt({ character, chunks, history, question });
    let answer = "";
    for await (const piece of chat.stream(messages, { signal })) {
      signal.throwIfAborted();
      answer += piece;
      onChunk(piece);
    }
    signal.throwIfAborted();
    if (!answer.trim()) throw new ProviderError(`${chat.name}: empty answer`);
    return { answer, sources: chunks.map(toSource) };
  });
