import { DurableObject } from "cloudflare:workers";
import type { ErrorType } from "./contract";
import type { Env } from "./env";

export const DEFAULT_DAILY_LIMIT = 10;
export const DEFAULT_GLOBAL_DAILY_LIMIT = 60;
export const GLOBAL_QUOTA_NAME = "global";

export type QuotaResult = { allowed: boolean; used: number; limit: number };

type Usage = { day: string; count: number };

export const parseLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

class DailyCounter extends DurableObject<Env> {
  private async used(day: string) {
    const usage = await this.ctx.storage.get<Usage>("usage");
    return usage?.day === day ? usage.count : 0;
  }

  async consume(limit: number, day: string): Promise<QuotaResult> {
    const used = await this.used(day);
    if (used >= limit) return { allowed: false, used, limit };
    await this.ctx.storage.put<Usage>("usage", { day, count: used + 1 });
    return { allowed: true, used: used + 1, limit };
  }

  async refund(day: string): Promise<void> {
    const used = await this.used(day);
    if (used > 0) await this.ctx.storage.put<Usage>("usage", { day, count: used - 1 });
  }
}

export class PlayerQuota extends DailyCounter {}

export class GlobalQuota extends DailyCounter {}

export type QuotaGrant =
  | { allowed: true; refund: () => Promise<void> }
  | { allowed: false; error: Extract<ErrorType, "rate_limited" | "global_rate_limited"> };

export const consumeQuota = async (env: Env, playerId: string, now = new Date()): Promise<QuotaGrant> => {
  const day = utcDay(now);
  const player = env.PLAYER_QUOTA.getByName(playerId);
  const global = env.GLOBAL_QUOTA.getByName(GLOBAL_QUOTA_NAME);
  if (!(await player.consume(parseLimit(env.DAILY_LIMIT, DEFAULT_DAILY_LIMIT), day)).allowed)
    return { allowed: false, error: "rate_limited" };
  if (!(await global.consume(parseLimit(env.GLOBAL_DAILY_LIMIT, DEFAULT_GLOBAL_DAILY_LIMIT), day)).allowed) {
    await player.refund(day);
    return { allowed: false, error: "global_rate_limited" };
  }
  return { allowed: true, refund: () => Promise.all([player.refund(day), global.refund(day)]).then(() => undefined) };
};
