import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCorpus } from "./corpus-loader.ts";

describe("corpus loader", () => {
  it("loads every real corpus file and validates every chunk's shape", async () => {
    const corpus = await loadCorpus("corpus");
    expect(corpus.errors).toEqual([]);
    expect(corpus.files.length).toBeGreaterThan(0);
    expect(corpus.chunks.length).toBeGreaterThan(0);
  });

  it("reports malformed chunks, unknown characters and duplicate ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "corpus-"));
    const valid = {
      id: "x-01",
      characterId: "princip",
      sourceTitle: "t",
      author: "a",
      year: 1918,
      license: "public-domain",
      location: "p. 1",
      url: "",
      language: "de",
      passage: "text",
    };
    await writeFile(
      join(dir, "a.json"),
      JSON.stringify([valid, { ...valid, id: "x-02", characterId: "lojka" }, { id: "x-03" }]),
    );
    await writeFile(join(dir, "b.json"), JSON.stringify([valid]));
    const { errors } = await loadCorpus(dir);
    expect(errors.some((error) => error.includes('unknown characterId "lojka"'))).toBe(true);
    expect(errors.some((error) => error.includes('missing or empty "passage"'))).toBe(true);
    expect(errors).toContain('duplicate chunk id "x-01"');
  });
});
