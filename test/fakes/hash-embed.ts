export const FAKE_DIMENSIONS = 64;

const tokenize = (text: string) => text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+/g) ?? [];

const hash = (token: string) =>
  [...token].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7) % FAKE_DIMENSIONS;

export const hashEmbed = (text: string): number[] =>
  tokenize(text).reduce(
    (vector, token) => vector.map((value, index) => (index === hash(token) ? value + 1 : value)),
    Array.from({ length: FAKE_DIMENSIONS }, () => 0),
  );
