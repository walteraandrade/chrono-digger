import { describe, expect, it } from "vitest";
import { newPlayerId, openChat } from "../client";
import { TEST_DAILY_LIMIT, TEST_GLOBAL_DAILY_LIMIT } from "../constants";
import { FAIL_TRIGGER } from "../fakes/providers";

describe("global daily cap", () => {
  it(`blocks every player after ${TEST_GLOBAL_DAILY_LIMIT} answers in total, not counting failed turns`, async () => {
    expect(TEST_GLOBAL_DAILY_LIMIT).toBeLessThan(TEST_DAILY_LIMIT);
    const first = await openChat("princip", newPlayerId());
    expect((await first.ask(`Pergunta ${FAIL_TRIGGER}`)).error).toBe("provider_failure");
    for (const index of Array.from({ length: TEST_GLOBAL_DAILY_LIMIT - 1 }, (_, i) => i))
      expect((await first.ask(`Pergunta ${index}`)).ended).toBe(true);

    const second = await openChat("harrach", newPlayerId());
    expect((await second.ask("Oi")).ended).toBe(true);

    const blocked = await second.ask("Mais uma");
    expect(blocked.error).toBe("global_rate_limited");
    expect(blocked.chunks).toEqual([]);
    const third = await openChat("potiorek", newPlayerId());
    expect((await third.ask("Oi")).error).toBe("global_rate_limited");
  });
});
