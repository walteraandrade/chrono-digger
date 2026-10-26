import { isValidAccessCode, isValidPlayerId } from "./access";
import { characters, findCharacter, toPublicCharacter } from "./characters";
import { CLOSE_CODES, type ErrorType, errorMessage } from "./contract";
import type { Env } from "./env";
import { CHARACTER_HEADER, PLAYER_HEADER } from "./session";

export const ACCESS_CODE_HEADER = "x-access-code";

const SESSION_PATH = /^\/api\/characters\/([^/]+)\/session$/;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const httpError = (error: ErrorType, status: number) => json(errorMessage(error), status);

const rejectSocket = (error: ErrorType) => {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.send(JSON.stringify(errorMessage(error)));
  server.close(CLOSE_CODES[error] ?? 1008, error);
  return new Response(null, { status: 101, webSocket: client });
};

const listCharacters = async (request: Request, env: Env) =>
  (await isValidAccessCode(env.ACCESS_CODE, request.headers.get(ACCESS_CODE_HEADER)))
    ? json({ characters: characters.map(toPublicCharacter) })
    : httpError("bad_access_code", 401);

const openSession = async (request: Request, env: Env, characterId: string) => {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
    return httpError("bad_request", 426);
  const params = new URL(request.url).searchParams;
  if (!(await isValidAccessCode(env.ACCESS_CODE, params.get("accessCode"))))
    return rejectSocket("bad_access_code");
  if (!findCharacter(characterId)) return rejectSocket("unknown_character");
  const playerId = params.get("playerId");
  if (!isValidPlayerId(playerId)) return rejectSocket("bad_request");
  const headers = new Headers(request.headers);
  headers.set(PLAYER_HEADER, playerId);
  headers.set(CHARACTER_HEADER, characterId);
  return env.CHARACTER_SESSION.getByName(`${playerId}:${characterId}`).fetch(
    new Request(request.url, { headers }),
  );
};

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
};

export const handleRequest = async (request: Request, env: Env): Promise<Response> => {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && pathname === "/api/characters") return listCharacters(request, env);
  const session = SESSION_PATH.exec(pathname);
  if (request.method === "GET" && session?.[1]) {
    const characterId = decodeSegment(session[1]);
    return characterId === undefined ? httpError("bad_request", 400) : openSession(request, env, characterId);
  }
  if (pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
  return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
};

export const worker = { fetch: handleRequest } satisfies ExportedHandler<Env>;
