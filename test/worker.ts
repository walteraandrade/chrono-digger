import { createVectorizeIndex } from "../src/providers/vectorize";
import { type ProviderRegistry, defaultRegistry } from "../src/providers/registry";
import { createCharacterSession } from "../src/session";
import { worker } from "../src/worker";
import { fakeChat, fakeEmbeddings } from "./fakes/providers";
import { hashEmbed } from "./fakes/hash-embed";
import { createMemoryVectorize } from "./fakes/memory-vectorize";
import { fixtureChunks } from "./fixtures/chunks";

const memoryIndex = createVectorizeIndex(createMemoryVectorize(fixtureChunks, hashEmbed));

const testRegistry: ProviderRegistry = {
  chat: { ...defaultRegistry.chat, fake: () => fakeChat },
  embeddings: { ...defaultRegistry.embeddings, fake: () => fakeEmbeddings },
  index: { ...defaultRegistry.index, memory: () => memoryIndex },
};

export { GlobalQuota, PlayerQuota } from "../src/quota";

export const CharacterSession = createCharacterSession(testRegistry);

export default worker;
