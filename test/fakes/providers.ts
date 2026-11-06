import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { type ChatProvider, type EmbeddingProvider, ProviderError } from "../../src/providers/types";
import { hashEmbed } from "./hash-embed";

export const FAIL_TRIGGER = "[fail]";
export const HANG_TRIGGER = "[hang]";
export const HANG_EMBED_TRIGGER = "[hang-embed]";

const rest = (question: string): Stream.Stream<string, ProviderError> => {
  if (question.includes(FAIL_TRIGGER)) return Stream.fail(new ProviderError({ message: "fake provider failure" }));
  if (question.includes(HANG_TRIGGER)) return Stream.never;
  return Stream.make(": ", question);
};

export const fakeChat: ChatProvider = {
  name: "fake",
  stream: (messages) => {
    const userTurns = messages.filter((message) => message.role === "user");
    const question = userTurns.at(-1)?.content ?? "";
    return Stream.make(`Resposta ${userTurns.length}`).pipe(Stream.concat(rest(question)));
  },
};

export const fakeEmbeddings: EmbeddingProvider = {
  name: "fake",
  embed: (texts) =>
    texts.some((text) => text.includes(HANG_EMBED_TRIGGER)) ? Effect.never : Effect.succeed(texts.map(hashEmbed)),
};
