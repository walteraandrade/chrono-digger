import type { ChatProvider, EmbeddingProvider } from "../../src/providers/types";
import { hashEmbed } from "./hash-embed";

export const FAIL_TRIGGER = "[fail]";
export const HANG_TRIGGER = "[hang]";
export const HANG_EMBED_TRIGGER = "[hang-embed]";

const never = () => new Promise<never>(() => undefined);

export const fakeChat: ChatProvider = {
  name: "fake",
  async *stream(messages) {
    const userTurns = messages.filter((message) => message.role === "user");
    const question = userTurns.at(-1)?.content ?? "";
    yield `Resposta ${userTurns.length}`;
    if (question.includes(FAIL_TRIGGER)) throw new Error("fake provider failure");
    if (question.includes(HANG_TRIGGER)) await never();
    yield ": ";
    yield question;
  },
};

export const fakeEmbeddings: EmbeddingProvider = {
  name: "fake",
  embed: async (texts) => {
    if (texts.some((text) => text.includes(HANG_EMBED_TRIGGER))) await never();
    return texts.map(hashEmbed);
  },
};
