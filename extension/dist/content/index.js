(function () {
  "use strict";

  const STORAGE_PREFIX = "figma-todo:";
  const FILE_PREFIX = "file:";
  const INDEX_KEY = "files-index";
  const POSITION_KEY = "button-position";
  const ROOT_ID = "figma-todo-root";
  const BUTTON_ID = "figma-todo-button";
  const PANEL_ID = "figma-todo-panel";

  const state = {
    fileKey: null,
    fileName: "Untitled",
    todos: [],
    panelMode: "todos",
    visible: false,
    pinned: false,
    inputLocked: false,
    mouseInPanel: false,
    mouseInButton: false,
    hideTimer: null,
    hoverTimer: null,
    drag: null,
    buttonPosition: null,
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("[Figma TodoList] Failed to read storage:", key, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }

  function getContext() {
    const match = location.href.match(/figma\.com\/(?:design|file)\/([^/?#]+)/);
    const titleMatch = document.title.match(/^(.+?)\s*[-–—|]\s*Figma$/i);
    return {
      fileKey: match ? match[1] : null,
      fileName: titleMatch ? titleMatch[1].trim() : "Untitled",
    };
  }

  function todoListKey(fileKey) {
    return FILE_PREFIX + fileKey;
  }

  function createEmptyList() {
    return {
      version: 1,
      fileKey: state.fileKey,
      fileName: state.fileName,
      lastModified: new Date().toISOString(),
      todos: [],
    };
  }

  function getTodoList() {
    if (!state.fileKey) return createEmptyList();
    const list = readJson(todoListKey(state.fileKey), null) || createEmptyList();
    list.fileName = state.fileName || list.fileName || "Untitled";
    list.todos = Array.isArray(list.todos) ? list.todos : [];
    return list;
  }

  function updateIndex(list) {
    const index = readJson(INDEX_KEY, { version: 1, files: {} });
    index.files = index.files || {};
    const now = new Date().toISOString();
    const openCount = list.todos.filter((todo) => !todo.completed).length;
    const previous = index.files[list.fileKey] || {};
    index.files[list.fileKey] = {
      fileName: list.fileName || "Untitled",
      todoCount: openCount,
      createdAt: previous.createdAt || now,
      lastAccessed: now,
    };
    writeJson(INDEX_KEY, index);
  }

  function saveTodoList(list) {
    if (!list.fileKey) return;
    list.lastModified = new Date().toISOString();
    writeJson(todoListKey(list.fileKey), list);
    updateIndex(list);
  }

  function loadTodos() {
    const list = getTodoList();
    state.todos = list.todos;
  }

  function addTodo(text) {
    const content = text.trim();
    if (!content || !state.fileKey) return;
    const list = getTodoList();
    const items = content
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const item of items.reverse()) {
      list.todos.unshift({
        id: "todo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9),
        content: item,
        completed: false,
        priority: item.includes("!high") ? "high" : item.includes("!low") ? "low" : "medium",
        createdAt: new Date().toISOString(),
        completedAt: null,
        nodeId: null,
        tags: [],
      });
    }

    saveTodoList(list);
    state.todos = list.todos;
  }

  function toggleTodo(id) {
    const list = getTodoList();
    const todo = list.todos.find((item) => item.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? new Date().toISOString() : null;
    saveTodoList(list);
    state.todos = list.todos;
  }

  function deleteTodo(id) {
    const list = getTodoList();
    list.todos = list.todos.filter((item) => item.id !== id);
    saveTodoList(list);
    state.todos = list.todos;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = el("div");
      root.id = ROOT_ID;
      document.documentElement.appendChild(root);
    }
    return root;
  }

  function injectStyles() {
    if (document.getElementById("figma-todo-styles")) return;
    const style = el("style");
    style.id = "figma-todo-styles";
    style.textContent = `
      #${BUTTON_ID}, #${PANEL_ID} {
        box-sizing: border-box;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${BUTTON_ID} {
        position: fixed;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #ececec;
        box-shadow: 0 1px 4px rgba(0,0,0,.12);
        z-index: 2147483646;
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1e1e1e;
        user-select: none;
      }
      #${BUTTON_ID}.dragging { cursor: grabbing; }
      #${BUTTON_ID} .badge {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: #24cb71;
        color: #fff;
        font-size: 11px;
        line-height: 18px;
        text-align: center;
        font-weight: 700;
      }
      #${PANEL_ID} {
        position: fixed;
        width: 260px;
        max-height: 420px;
        background: #ffffff;
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,.18);
        z-index: 2147483645;
        display: none;
        overflow: hidden;
        flex-direction: column;
        color: #1e1e1e;
      }
      #${PANEL_ID} .header {
        height: 42px;
        padding: 0 10px 0 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid #eeeeee;
      }
      #${PANEL_ID} .title {
        flex: 1;
        font-size: 13px;
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PANEL_ID} button {
        border: 0;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: inherit;
      }
      #${PANEL_ID} button:hover { background: #f2f2f2; }
      #${PANEL_ID} .icon-btn {
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }
      #${PANEL_ID} .list {
        overflow: auto;
        padding: 8px;
        min-height: 70px;
      }
      #${PANEL_ID} .empty {
        padding: 28px 8px;
        text-align: center;
        color: #777;
        font-size: 12px;
      }
      #${PANEL_ID} .todo {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        padding: 7px 5px;
        border-radius: 8px;
      }
      #${PANEL_ID} .todo:hover { background: #e9f9ff; }
      #${PANEL_ID} .check {
        width: 16px;
        height: 16px;
        margin-top: 1px;
        border-radius: 50%;
        border: 2px solid #0d99ff;
        flex: 0 0 auto;
        background: #fff;
      }
      #${PANEL_ID} .todo.done .check { background: #0d99ff; box-shadow: inset 0 0 0 3px #fff; }
      #${PANEL_ID} .content {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        line-height: 17px;
        word-break: break-word;
      }
      #${PANEL_ID} .todo.done .content {
        color: #777;
        text-decoration: line-through;
      }
      #${PANEL_ID} .delete {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        color: #777;
        display: none;
      }
      #${PANEL_ID} .todo:hover .delete { display: inline-flex; align-items: center; justify-content: center; }
      #${PANEL_ID} .input-row {
        display: flex;
        gap: 8px;
        padding: 10px;
        border-top: 1px solid #eeeeee;
      }
      #${PANEL_ID} textarea {
        flex: 1;
        min-width: 0;
        height: 32px;
        max-height: 90px;
        resize: none;
        border: 1px solid #dddddd;
        border-radius: 7px;
        padding: 6px 9px;
        font: inherit;
        font-size: 12px;
        line-height: 18px;
        outline: none;
      }
      #${PANEL_ID} textarea:focus { border-color: #0d99ff; box-shadow: 0 0 0 2px rgba(13,153,255,.16); }
      #${PANEL_ID} .add {
        width: 32px;
        height: 32px;
        background: #0d99ff;
        color: #fff;
        font-size: 18px;
      }
      #${PANEL_ID} .files .file {
        padding: 10px;
        border: 1px solid #eeeeee;
        border-radius: 8px;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .file-name { font-size: 12px; font-weight: 650; }
      #${PANEL_ID} .file-count { font-size: 11px; color: #777; margin-top: 4px; }
    `;
    document.head.appendChild(style);
  }

  function buttonHtml() {
    return `
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="8" cy="9" r="3" fill="#00B6FF"></circle>
        <circle cx="8" cy="16" r="3" fill="#24CB71"></circle>
        <circle cx="8" cy="23" r="3" fill="#FF7676"></circle>
        <path d="M15 9h11M15 16h11M15 23h11" stroke="#999" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      <span class="badge">0</span>
    `;
  }

  function getButtonPosition() {
    const saved = readJson(POSITION_KEY, null);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    return { x: Math.max(16, window.innerWidth - 72), y: Math.max(80, window.innerHeight / 2 - 24) };
  }

  function clampPosition(position) {
    return {
      x: Math.max(8, Math.min(position.x, window.innerWidth - 56)),
      y: Math.max(8, Math.min(position.y, window.innerHeight - 56)),
    };
  }

  function positionPanel() {
    const button = document.getElementById(BUTTON_ID);
    const panel = document.getElementById(PANEL_ID);
    if (!button || !panel) return;
    const b = button.getBoundingClientRect();
    const width = 260;
    const height = Math.min(panel.offsetHeight || 320, 420);
    const gap = 10;
    let left = b.left > window.innerWidth / 2 ? b.left - width - gap : b.right + gap;
    let top = b.top + b.height / 2 - height / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  function updateBadge() {
    const badge = document.querySelector("#" + BUTTON_ID + " .badge");
    if (!badge) return;
    const count = state.todos.filter((todo) => !todo.completed).length;
    badge.textContent = count > 99 ? "99+" : String(count);
  }

  function clearHideTimer() {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
  }

  function isInputLocked() {
    const input = document.querySelector("#" + PANEL_ID + " textarea");
    return state.inputLocked || Boolean(input && (document.activeElement === input || input.value.trim()));
  }

  function lockInputPanel() {
    state.inputLocked = true;
    clearHideTimer();
  }

  function unlockInputPanel() {
    state.inputLocked = false;
  }

  function scheduleHide(delay) {
    clearHideTimer();
    if (state.pinned || isInputLocked() || state.mouseInPanel || state.mouseInButton) return;
    state.hideTimer = window.setTimeout(() => {
      if (!state.pinned && !isInputLocked() && !state.mouseInPanel && !state.mouseInButton) hidePanel();
    }, delay);
  }

  function showPanel(mode) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || !state.fileKey) return;
    state.visible = true;
    state.panelMode = mode || state.panelMode || "todos";
    clearHideTimer();
    loadTodos();
    renderPanel();
    panel.style.display = "flex";
    requestAnimationFrame(positionPanel);
  }

  function hidePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    clearHideTimer();
    unlockInputPanel();
    state.visible = false;
    panel.style.display = "none";
  }

  function renderPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.innerHTML = "";

    const header = el("div", "header");
    const title = el("div", "title", state.panelMode === "files" ? "All design files" : state.fileName);
    const filesBtn = el("button", "icon-btn", state.panelMode === "files" ? "Back" : "List");
    filesBtn.title = state.panelMode === "files" ? "Back to current file" : "View all files";
    filesBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      state.panelMode = state.panelMode === "files" ? "todos" : "files";
      renderPanel();
      requestAnimationFrame(positionPanel);
    });
    const pinBtn = el("button", "icon-btn", state.pinned ? "Pin*" : "Pin");
    pinBtn.title = state.pinned ? "Unpin panel" : "Pin panel";
    pinBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      state.pinned = !state.pinned;
      renderPanel();
      requestAnimationFrame(positionPanel);
    });
    header.append(title, filesBtn, pinBtn);
    panel.appendChild(header);

    if (state.panelMode === "files") {
      renderFiles(panel);
    } else {
      renderTodos(panel);
      renderInput(panel);
    }

    updateBadge();
  }

  function renderTodos(panel) {
    const list = el("div", "list");
    const sorted = [...state.todos].sort((a, b) => Number(a.completed) - Number(b.completed));
    if (sorted.length === 0) {
      list.appendChild(el("div", "empty", "No todos yet. Add one below."));
    } else {
      for (const todo of sorted) {
        const row = el("div", "todo" + (todo.completed ? " done" : ""));
        const check = el("button", "check");
        check.title = todo.completed ? "Mark as todo" : "Mark as done";
        check.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleTodo(todo.id);
          renderPanel();
        });
        const content = el("div", "content", todo.content);
        const remove = el("button", "delete", "x");
        remove.title = "Delete";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          deleteTodo(todo.id);
          renderPanel();
        });
        row.append(check, content, remove);
        list.appendChild(row);
      }
    }
    panel.appendChild(list);
  }

  function renderInput(panel) {
    const row = el("div", "input-row");
    const input = el("textarea");
    input.rows = 1;
    input.placeholder = "Input todo, press Enter";
    input.addEventListener("focus", lockInputPanel);
    input.addEventListener("input", () => {
      lockInputPanel();
      input.style.height = "32px";
      input.style.height = Math.min(input.scrollHeight, 90) + "px";
      requestAnimationFrame(positionPanel);
    });
    input.addEventListener("blur", () => {
      if (!input.value.trim()) unlockInputPanel();
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      lockInputPanel();
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitInput(input);
      }
    });
    input.addEventListener("paste", (event) => {
      event.stopPropagation();
      lockInputPanel();
    });
    input.addEventListener("click", (event) => event.stopPropagation());

    const add = el("button", "add", "+");
    add.title = "Add todo";
    add.addEventListener("click", (event) => {
      event.stopPropagation();
      submitInput(input);
    });
    row.append(input, add);
    panel.appendChild(row);
  }

  function submitInput(input) {
    const value = input.value.trim();
    if (!value) {
      unlockInputPanel();
      return;
    }
    addTodo(value);
    input.value = "";
    unlockInputPanel();
    renderPanel();
    if (!state.mouseInPanel && !state.pinned) scheduleHide(900);
  }

  function renderFiles(panel) {
    const wrap = el("div", "list files");
    const index = readJson(INDEX_KEY, { files: {} });
    const files = Object.entries(index.files || {}).sort(([, a], [, b]) => {
      return new Date(b.lastAccessed || 0).getTime() - new Date(a.lastAccessed || 0).getTime();
    });
    if (files.length === 0) {
      wrap.appendChild(el("div", "empty", "No files with todos yet."));
    } else {
      for (const [fileKey, file] of files) {
        const card = el("div", "file");
        const name = el("div", "file-name", file.fileName || "Untitled");
        const count = el("div", "file-count", (file.todoCount || 0) + " open todos");
        card.append(name, count);
        card.addEventListener("click", () => {
          window.open("https://www.figma.com/design/" + fileKey, "_blank");
        });
        wrap.appendChild(card);
      }
    }
    panel.appendChild(wrap);
  }

  function createButton() {
    const button = el("div");
    button.id = BUTTON_ID;
    button.innerHTML = buttonHtml();
    state.buttonPosition = clampPosition(getButtonPosition());
    button.style.left = state.buttonPosition.x + "px";
    button.style.top = state.buttonPosition.y + "px";

    button.addEventListener("mouseenter", () => {
      state.mouseInButton = true;
      clearHideTimer();
      state.hoverTimer = window.setTimeout(() => showPanel("todos"), 250);
    });
    button.addEventListener("mouseleave", () => {
      state.mouseInButton = false;
      if (state.hoverTimer) clearTimeout(state.hoverTimer);
      scheduleHide(600);
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      showPanel("todos");
    });
    button.addEventListener("mousedown", startDrag);
    return button;
  }

  function startDrag(event) {
    event.preventDefault();
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    state.drag = {
      startX: event.clientX,
      startY: event.clientY,
      originX: state.buttonPosition.x,
      originY: state.buttonPosition.y,
      moved: false,
    };
    button.classList.add("dragging");
    document.addEventListener("mousemove", dragMove, true);
    document.addEventListener("mouseup", dragEnd, true);
  }

  function dragMove(event) {
    if (!state.drag) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.drag.moved = true;
    state.buttonPosition = clampPosition({
      x: state.drag.originX + dx,
      y: state.drag.originY + dy,
    });
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.style.left = state.buttonPosition.x + "px";
      button.style.top = state.buttonPosition.y + "px";
    }
    if (state.visible) positionPanel();
  }

  function dragEnd() {
    const button = document.getElementById(BUTTON_ID);
    if (button) button.classList.remove("dragging");
    if (state.drag && state.drag.moved) writeJson(POSITION_KEY, state.buttonPosition);
    state.drag = null;
    document.removeEventListener("mousemove", dragMove, true);
    document.removeEventListener("mouseup", dragEnd, true);
  }

  function createPanel() {
    const panel = el("div");
    panel.id = PANEL_ID;
    panel.addEventListener("mouseenter", () => {
      state.mouseInPanel = true;
      clearHideTimer();
    });
    panel.addEventListener("mouseleave", () => {
      state.mouseInPanel = false;
      scheduleHide(800);
    });
    panel.addEventListener("mousedown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());
    return panel;
  }

  function init() {
    const context = getContext();
    if (!context.fileKey) return;
    state.fileKey = context.fileKey;
    state.fileName = context.fileName;
    injectStyles();
    loadTodos();

    const root = getRoot();
    root.innerHTML = "";
    root.append(createButton(), createPanel());
    updateBadge();

    window.addEventListener("resize", () => {
      state.buttonPosition = clampPosition(state.buttonPosition || getButtonPosition());
      const button = document.getElementById(BUTTON_ID);
      if (button) {
        button.style.left = state.buttonPosition.x + "px";
        button.style.top = state.buttonPosition.y + "px";
      }
      if (state.visible) positionPanel();
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "TOGGLE_TODO_LIST") return;
      state.visible ? hidePanel() : showPanel("todos");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
