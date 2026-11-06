const STORAGE = { playerId: "chrono.playerId", accessCode: "chrono.accessCode" };

const ERROR_TEXT = {
  bad_access_code: "Código de acesso inválido. Confira com seu professor.",
  rate_limited: "Você chegou ao limite de perguntas de hoje. Volte amanhã!",
  global_rate_limited: "A turma usou toda a cota de hoje. Voltem amanhã!",
  provider_failure: "A resposta falhou no meio do caminho. Tente perguntar de novo.",
  unknown_character: "Esse personagem não está na cena.",
  bad_request: "Não entendi a pergunta. Escreva de novo (até 1000 caracteres).",
  busy: "Espere a resposta anterior terminar.",
  diary_failure: "Não deu para conferir a palavra. Tente de novo.",
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

const state = {
  accessCode: storage.get(STORAGE.accessCode) ?? "",
  accessOpen: false,
  characters: [],
  current: null,
  conn: null,
  busy: false,
  caseQuestion: "",
  diary: null,
  drafts: new Map(),
  feedback: new Map(),
  filling: new Set(),
  asked: new Set(),
  tab: "conversation",
};

const BLANK = "____";
const CASE_OWNER = "case";
const FILL_FAILURES = new Set(["bad_request", "diary_failure"]);
const FEEDBACK_TEXT = {
  wrong: "Ainda não é essa palavra.",
  connection: ERROR_TEXT.connection,
  bad_request: "Essa linha não aceita essa palavra.",
  diary_failure: ERROR_TEXT.diary_failure,
};

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
  return response.json();
};

const portraitUrl = (character) => `/portraits/${encodeURIComponent(character.id)}.png`;

const portrait = (character, className) =>
  el("img", {
    className: `portrait ${className}`,
    src: portraitUrl(character),
    alt: "",
    width: 64,
    height: 64,
    onerror: (event) => {
      event.currentTarget.hidden = true;
    },
  });

const progressText = ({ filled, total }) => `${filled} de ${total}`;

const renderCast = () => {
  $("cast-case").textContent = state.caseQuestion;
  $("cast-progress").textContent = state.diary ? `Seu diário: ${progressText(state.diary)}` : "";
  $("cast-progress").hidden = !state.diary;
  $("character-list").replaceChildren(
    ...state.characters.map((character) =>
      el("li", {}, [
        el("button", { type: "button", className: "card", onclick: () => openChat(character) }, [
          portrait(character, "portrait-card"),
          el("div", {}, [
            el("strong", { textContent: character.displayName }),
            el("span", { textContent: character.description }),
          ]),
        ]),
      ]),
    ),
  );
};

const enterScene = async (accessCode) => {
  showError("access-error", null);
  try {
    const { characters, caseQuestion } = await fetchCharacters(accessCode);
    state.characters = characters;
    state.caseQuestion = caseQuestion ?? "";
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

const renderSuggestions = () => {
  const suggestions = (state.diary?.suggestions ?? []).filter(
    ({ characterId, text }) => characterId === state.current?.id && !state.asked.has(text),
  );
  $("suggestions").replaceChildren(
    ...suggestions.map(({ text }) =>
      el("button", {
        type: "button",
        className: "suggestion",
        textContent: text,
        disabled: state.busy,
        onclick: () => ask(text),
      }),
    ),
  );
  $("suggestions").hidden = suggestions.length === 0;
};

const setBusy = (busy) => {
  state.busy = busy;
  $("send").disabled = busy;
  $("question").disabled = busy;
  renderSuggestions();
};

const ownerName = (owner) =>
  owner === CASE_OWNER ? "O caso" : (state.characters.find(({ id }) => id === owner)?.displayName ?? owner);

const renderFillForm = (line, before, after) => {
  const input = el("input", {
    type: "text",
    maxLength: 64,
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: false,
    placeholder: "palavra",
    value: state.drafts.get(line.id) ?? "",
    ariaLabel: `Palavra que falta: ${line.text.replace(BLANK, "lacuna")}`,
    oninput: (event) => {
      state.drafts.set(line.id, event.currentTarget.value);
    },
  });
  input.dataset.lineId = line.id;
  return el(
    "form",
    {
      className: "fill",
      onsubmit: (event) => {
        event.preventDefault();
        submitFill(line.id);
      },
    },
    [
      ...(before ? [el("span", { textContent: before })] : []),
      input,
      ...(after ? [el("span", { textContent: after })] : []),
      el("button", {
        type: "submit",
        textContent: "OK",
        ariaLabel: "Conferir palavra",
        disabled: state.filling.has(line.id),
      }),
    ],
  );
};

const renderLineBody = (line) => {
  const [before = "", after = ""] = line.text.split(BLANK);
  if (!line.blank) return el("span", { textContent: line.text });
  if (!line.blank.filled) return renderFillForm(line, before, after);
  return el("span", {}, [before, el("span", { className: "diary-word", textContent: line.blank.word }), after]);
};

const renderLine = (line, highlighted) => {
  const feedback = FEEDBACK_TEXT[state.feedback.get(line.id)];
  const classes = ["diary-line", line.secret && "is-secret", highlighted.has(line.id) && "is-new"];
  return el("li", { className: classes.filter(Boolean).join(" ") }, [
    el("span", { className: "diary-owner", textContent: `${line.secret ? "★ " : ""}${ownerName(line.owner)}` }),
    renderLineBody(line),
    ...(feedback ? [el("span", { className: "fill-feedback", textContent: feedback })] : []),
  ]);
};

const diaryHint = ({ lines, total, filled }) => {
  const closed = total - lines.length;
  if (closed > 0) return `${closed === 1 ? "Falta 1 linha" : `Faltam ${closed} linhas`}. Continue conversando para abrir.`;
  return filled < total ? "Todas as linhas abriram. Falta escrever as palavras." : "";
};

const renderClosing = (closing) => {
  $("diary-closing").hidden = !closing;
  $("diary-closing").replaceChildren(
    ...(closing
      ? [
          el("h3", { textContent: "O que as fontes dizem" }),
          el("p", { textContent: closing.text }),
          el("ul", {}, closing.references.map((reference) => el("li", { textContent: reference }))),
        ]
      : []),
  );
};

const focusedLineId = () => document.activeElement?.dataset?.lineId;

const lineInput = (lineId) => document.querySelector(`input[data-line-id="${CSS.escape(lineId)}"]`);

const renderDiary = (highlighted = new Set()) => {
  const { diary } = state;
  $("chat-case").textContent = diary?.caseQuestion ?? state.caseQuestion;
  $("tab-diary").textContent = diary ? `Diário ${diary.filled}/${diary.total}` : "Diário";
  if (!diary) {
    $("diary-count").textContent = "";
    $("diary-lines").replaceChildren();
    $("diary-hint").textContent = "O diário não abriu. Volte e entre na conversa de novo.";
    return renderClosing(undefined);
  }
  const focused = focusedLineId();
  const selection = focused && [document.activeElement.selectionStart, document.activeElement.selectionEnd];
  $("diary-count").textContent = `${progressText(diary)}${diary.secretsOpen > 0 ? ` · ★ ${diary.secretsOpen}` : ""}`;
  $("diary-progress").max = Math.max(diary.total, 1);
  $("diary-progress").value = diary.filled;
  $("diary-lines").replaceChildren(...diary.lines.map((line) => renderLine(line, highlighted)));
  $("diary-hint").textContent = diaryHint(diary);
  renderClosing(diary.closing);
  const restored = focused && lineInput(focused);
  if (restored) {
    restored.focus();
    restored.setSelectionRange(...selection);
  } else if (focused) document.querySelector(".fill input")?.focus();
};

const changedLineIds = (previous, next) => {
  if (!previous) return new Set();
  const before = new Map(previous.lines.map((line) => [line.id, line.blank?.filled]));
  return new Set(
    next.lines.filter((line) => !before.has(line.id) || before.get(line.id) !== line.blank?.filled).map(({ id }) => id),
  );
};

const setTab = (tab) => {
  state.tab = tab;
  $("chat").dataset.tab = tab;
  $("tab-conversation").setAttribute("aria-pressed", String(tab === "conversation"));
  $("tab-diary").setAttribute("aria-pressed", String(tab === "diary"));
  if (tab === "diary") $("tab-diary").classList.remove("has-news");
};

const applyDiary = ({ type: _type, ...diary }) => {
  const changed = changedLineIds(state.diary, diary);
  const opened = state.diary ? diary.lines.length - state.diary.lines.length : 0;
  state.diary = diary;
  renderDiary(changed);
  renderSuggestions();
  if (changed.size === 0) return;
  if (state.tab !== "diary") $("tab-diary").classList.add("has-news");
  $("diary-status").textContent =
    opened > 0
      ? `${opened === 1 ? "Nova linha" : `${opened} novas linhas`} no diário. ${progressText(diary)}.`
      : `Palavra certa. ${progressText(diary)}.`;
};

const settleFill = (conn, lineId, outcome) => {
  conn.fills = conn.fills.filter((id) => id !== lineId);
  state.filling.delete(lineId);
  if (outcome) state.feedback.set(lineId, outcome);
  else {
    state.feedback.delete(lineId);
    state.drafts.delete(lineId);
  }
  renderDiary();
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
  if (pending) {
    pending.answer.item.classList.remove("pending");
    state.asked.add(pending.text);
  }
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
    message.messages
      .filter(({ role }) => role === "user")
      .forEach(({ text }) => state.asked.add(text));
    conn.historySeen = true;
    return renderSuggestions();
  }
  if (message.type === "diary") return applyDiary(message);
  if (message.type === "fillResult") return settleFill(conn, message.lineId, message.correct ? null : "wrong");
  if (message.type === "error" && FILL_FAILURES.has(message.error) && conn.fills.length > 0)
    return settleFill(conn, conn.fills[0], message.error);
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
      fills: [],
    };
    state.conn = conn;
    conn.socket.addEventListener("message", (event) => handleServerMessage(conn, parseMessage(event.data)));
    conn.socket.addEventListener("open", () => resolve(conn));
    conn.socket.addEventListener("error", () => resolve(conn));
    conn.socket.addEventListener("close", () => {
      resolve(conn);
      conn.fills.forEach((lineId) => settleFill(conn, lineId, "connection"));
      if (!isCurrent(conn)) return;
      if (conn.pending) failTurn(conn, "connection");
      state.conn = null;
    });
  });

const isOpen = (conn) => conn !== null && conn.socket.readyState === WebSocket.OPEN;

const openChat = async (character) => {
  closeConnection();
  state.current = character;
  $("chat-portrait").replaceWith(Object.assign(portrait(character, "portrait-header"), { id: "chat-portrait" }));
  $("chat-name").textContent = character.displayName;
  $("chat-description").textContent = character.description;
  $("messages").replaceChildren();
  state.asked = new Set();
  showError("chat-error", null);
  setTab("conversation");
  renderDiary();
  renderSuggestions();
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
  conn.pending = { text, question: appendMessage("user", text), answer: appendMessage("assistant", "") };
  conn.pending.answer.item.classList.add("pending");
  conn.socket.send(JSON.stringify({ type: "ask", text }));
};

const submitFill = async (lineId) => {
  const word = (state.drafts.get(lineId) ?? "").trim();
  if (!word || state.filling.has(lineId)) return;
  state.feedback.delete(lineId);
  state.filling.add(lineId);
  renderDiary();
  const character = state.current;
  const conn = isOpen(state.conn) ? state.conn : await connect(character, { replayHistory: false });
  if (!isOpen(conn)) {
    state.filling.delete(lineId);
    state.feedback.set(lineId, "connection");
    return renderDiary();
  }
  conn.fills.push(lineId);
  conn.socket.send(JSON.stringify({ type: "fill", lineId, word }));
};

$("access-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("access-code").value.trim();
  if (code || state.accessOpen) enterScene(code);
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
  renderCast();
  show("cast");
});

$("tab-conversation").addEventListener("click", () => setTab("conversation"));
$("tab-diary").addEventListener("click", () => setTab("diary"));

if (state.accessCode) $("access-code").value = state.accessCode;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const openAccessIfBypassed = async () => {
  if (!LOCAL_HOSTNAMES.has(location.hostname)) return;
  const response = await fetch("/api/characters").catch(() => null);
  if (!response?.ok) return;
  state.accessOpen = true;
  $("access-code").required = false;
  $("access-code").hidden = true;
  document.querySelector('label[for="access-code"]').hidden = true;
};

openAccessIfBypassed();
