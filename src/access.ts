import type { Env } from "./env";

const digest = async (value: string) =>
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

const isValidAccessCode = async (expected: string | undefined, given: string | null) => {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([digest(expected), digest(given)]);
  return crypto.subtle.timingSafeEqual(a, b);
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isDevBypass = (request: Request, env: Env) =>
  env.ACCESS_CODE_DISABLED === "true" && LOCAL_HOSTNAMES.has(new URL(request.url).hostname);

export const hasAccess = async (request: Request, env: Env, given: string | null) =>
  isDevBypass(request, env) || isValidAccessCode(env.ACCESS_CODE, given);

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const isValidPlayerId = (value: string | null): value is string =>
  value !== null && PLAYER_ID_PATTERN.test(value);
