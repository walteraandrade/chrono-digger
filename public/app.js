const STORAGE = { playerId: "chrono.playerId", accessCode: "chrono.accessCode" };

const ERROR_TEXT = {
  bad_access_code: "Código de acesso inválido. Confira com seu professor.",
  rate_limited: "Você chegou ao limite de perguntas de hoje. Volte amanhã!",
  global_rate_limited: "A turma usou toda a cota de hoje. Voltem amanhã!",
  provider_failure: "A resposta falhou no meio do caminho. Tente perguntar de novo.",
  unknown_character: "Esse personagem não está na cena.",
  bad_request: "Não entendi a pergunta. Escreva de novo (até 1000 caracteres).",
  busy: "Espere a resposta anterior terminar.",
  connection: "A conexão caiu. Envie a pergunta de novo para reconectar.",
  network: "Não consegui falar com o servidor. Verifique sua internet.",
};

const $ = (id) => document.getElementById(id);

const storage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      return undefined;
    }
  },
};

const playerId = (() => {
  const existing = storage.get(STORAGE.playerId);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.set(STORAGE.playerId, created);
  return created;
})();

const state = { accessCode: storage.get(STORAGE.accessCode) ?? "", characters: [], current: null, conn: null, busy: false };

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const show = (screenId) =>
  ["intro", "cast", "chat"].forEach((id) => {
    $(id).hidden = id !== screenId;
  });

const showError = (id, key) => {
  $(id).textContent = key ? ERROR_TEXT[key] ?? ERROR_TEXT.provider_failure : "";
  $(id).hidden = !key;
};

const fetchCharacters = async (accessCode) => {
  const response = await fetch("/api/characters", { headers: { "x-access-code": accessCode } });
  if (response.status === 401) throw new Error("bad_access_code");
  if (!response.ok) throw new Error("network");
  return (await response.json()).characters;
};

const renderCast = () => {
  $("character-list").replaceChildren(
    ...state.characters.map((character) =>
      el("li", {}, [
        el("button", { type: "button", className: "card", onclick: () => openChat(character) }, [
          el("strong", { textContent: character.displayName }),
          el("span", { textContent: character.description }),
        ]),
      ]),
    ),
  );
};

const enterScene = async (accessCode) => {
  showError("access-error", null);
  try {
    state.characters = await fetchCharacters(accessCode);
    state.accessCode = accessCode;
    storage.set(STORAGE.accessCode, accessCode);
    renderCast();
    show("cast");
  } catch (error) {
    showError("access-error", error.message === "bad_access_code" ? "bad_access_code" : "network");
  }
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const renderSources = (sources) =>
  el("details", { className: "sources" }, [
    el("summary", {
      textContent: sources.length > 0 ? `Fontes (${sources.length})` : "Nenhuma passagem das fontes cobre isto",
    }),
    ...sources.map((source) =>
      el("div", { className: "source" }, [
        el("div", {}, [el("strong", { textContent: source.sourceTitle })]),
        el("div", {
          className: "ref",
          textContent: `${source.author}, ${source.year} · ${source.location} · Licença: ${source.license}`,
        }),
        el("blockquote", { textContent: source.passage }),
        ...(isHttpsUrl(source.url)
          ? [el("a", { href: source.url, target: "_blank", rel: "noopener noreferrer", textContent: "Ver a página" })]
          : []),
      ]),
    ),
  ]);

const appendMessage = (role, text, sources) => {
  const textNode = el("div", { className: "text", textContent: text });
  const item = el("li", { className: `message ${role}` }, [textNode]);
  if (sources) item.append(renderSources(sources));
  $("messages").append(item);
  item.scrollIntoView({ block: "end", behavior: "smooth" });
  return { item, textNode };
};

const setBusy = (busy) => {
  state.busy = busy;
  $("send").disabled = busy;
  $("question").disabled = busy;
};

const isCurrent = (conn) => state.conn === conn;

const markFailed = ({ question, answer }) => {
  answer.item.remove();
  question.item.classList.add("failed");
  question.item.append(el("span", { className: "failure", textContent: "Sem resposta. Esta pergunta não foi salva." }));
};

const failTurn = (conn, errorKey) => {
  const pending = conn.pending;
  conn.pending = null;
  if (pending) markFailed(pending);
  if (!isCurrent(conn)) return;
  showError("chat-error", errorKey);
  setBusy(false);
};

const finishTurn = (conn) => {
  const pending = conn.pending;
  conn.pending = null;
  if (pending) pending.answer.item.classList.remove("pending");
  if (isCurrent(conn)) setBusy(false);
};

const closeConnection = () => {
  const conn = state.conn;
  state.conn = null;
  setBusy(false);
  if (conn) conn.socket.close(1000);
};

const returnToIntro = () => {
  closeConnection();
  state.accessCode = "";
  storage.set(STORAGE.accessCode, "");
  $("access-code").value = "";
  show("intro");
  showError("access-error", "bad_access_code");
};

const parseMessage = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const handleServerMessage = (conn, message) => {
  if (!isCurrent(conn) || !message) return;
  if (message.type === "history") {
    if (conn.replayHistory && !conn.historySeen)
      message.messages.forEach((entry) =>
        appendMessage(entry.role, entry.text, entry.role === "assistant" ? entry.sources : undefined),
      );
    conn.historySeen = true;
    return;
  }
  if (message.type === "error")
    return message.error === "bad_access_code" ? returnToIntro() : failTurn(conn, message.error);
  const pending = conn.pending;
  if (!pending) return;
  if (message.type === "chunk") {
    pending.answer.textNode.textContent += message.text;
    return pending.answer.item.scrollIntoView({ block: "end" });
  }
  if (message.type === "sources") return pending.answer.item.append(renderSources(message.sources));
  if (message.type === "end") return finishTurn(conn);
};

const socketUrl = (characterId) => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ playerId, accessCode: state.accessCode });
  return `${protocol}//${location.host}/api/characters/${encodeURIComponent(characterId)}/session?${params}`;
};

const connect = (character, { replayHistory }) =>
  new Promise((resolve) => {
    const conn = {
      socket: new WebSocket(socketUrl(character.id)),
      character,
      replayHistory,
      historySeen: false,
      pending: null,
    };
    state.conn = conn;
    conn.socket.addEventListener("message", (event) => handleServerMessage(conn, parseMessage(event.data)));
    conn.socket.addEventListener("open", () => resolve(conn));
    conn.socket.addEventListener("error", () => resolve(conn));
    conn.socket.addEventListener("close", () => {
      resolve(conn);
      if (!isCurrent(conn)) return;
      if (conn.pending) failTurn(conn, "connection");
      state.conn = null;
    });
  });

const isOpen = (conn) => conn !== null && conn.socket.readyState === WebSocket.OPEN;

const openChat = async (character) => {
  closeConnection();
  state.current = character;
  $("chat-name").textContent = character.displayName;
  $("chat-description").textContent = character.description;
  $("messages").replaceChildren();
  showError("chat-error", null);
  show("chat");
  await connect(character, { replayHistory: true });
  $("question").focus();
};

const ask = async (text) => {
  showError("chat-error", null);
  setBusy(true);
  const character = state.current;
  const conn = isOpen(state.conn) ? state.conn : await connect(character, { replayHistory: false });
  if (!isCurrent(conn) || state.current !== character) return;
  if (!isOpen(conn)) {
    $("question").value = text;
    showError("chat-error", "connection");
    return setBusy(false);
  }
  conn.pending = { question: appendMessage("user", text), answer: appendMessage("assistant", "") };
  conn.pending.answer.item.classList.add("pending");
  conn.socket.send(JSON.stringify({ type: "ask", text }));
};

$("access-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("access-code").value.trim();
  if (code) enterScene(code);
});

$("ask-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("question").value.trim();
  if (!text || state.busy) return;
  $("question").value = "";
  ask(text);
});

$("question").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("ask-form").requestSubmit();
  }
});

$("back").addEventListener("click", () => {
  closeConnection();
  show("cast");
});

if (state.accessCode) $("access-code").value = state.accessCode;
