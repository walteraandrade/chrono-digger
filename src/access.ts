const digest = async (value: string) =>
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

export const isValidAccessCode = async (expected: string | undefined, given: string | null) => {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([digest(expected), digest(given)]);
  return crypto.subtle.timingSafeEqual(a, b);
};

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const isValidPlayerId = (value: string | null): value is string =>
  value !== null && PLAYER_ID_PATTERN.test(value);
