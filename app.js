import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJ9Vvhp0iEdELiTHy3Mg6dr6eZLM5diA8",
  authDomain: "sh-todo-aa705.firebaseapp.com",
  databaseURL: "https://sh-todo-aa705-default-rtdb.firebaseio.com",
  projectId: "sh-todo-aa705",
  storageBucket: "sh-todo-aa705.firebasestorage.app",
  messagingSenderId: "1086724779017",
  appId: "1:1086724779017:web:ff670ddc8cef8f80e5dcd8",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const todosRef = ref(db, "todos");

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const countEl = document.getElementById("todo-count");
const emptyState = document.getElementById("empty-state");
const listStatus = document.getElementById("list-status");
const submitButton = form.querySelector('button[type="submit"]');

/** @type {{ id: string, text: string, createdAt: number }[]} */
let todos = [];
let editingId = null;
let hasLoaded = false;

function setListStatus(message, isError = false) {
  if (!message) {
    listStatus.classList.add("hidden");
    listStatus.textContent = "";
    listStatus.classList.remove("error");
    return;
  }

  listStatus.classList.remove("hidden");
  listStatus.classList.toggle("error", isError);
  listStatus.textContent = message;
}

/** Realtime Database `todos` 경로에서 할일 목록을 가져와 화면에 반영합니다. */
function loadTodosFromRealtimeDatabase() {
  setListStatus("목록을 불러오는 중…");

  onValue(
    todosRef,
    (snapshot) => {
      hasLoaded = true;
      const data = snapshot.val();

      if (!data) {
        todos = [];
        setListStatus("");
        render();
        return;
      }

      todos = Object.entries(data)
        .map(([id, value]) => ({
          id,
          text: String(value?.text ?? ""),
          createdAt: Number(value?.createdAt ?? 0),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      setListStatus("");
      render();
    },
    (error) => {
      console.error("할일 목록을 불러오지 못했습니다.", error);
      setListStatus("Realtime Database에서 목록을 불러오지 못했습니다.", true);
      if (!hasLoaded) {
        todos = [];
        render();
      }
    }
  );
}

loadTodosFromRealtimeDatabase();

async function updateTodo(id, text) {
  await update(ref(db, `todos/${id}`), { text });
}

async function deleteTodo(id) {
  await remove(ref(db, `todos/${id}`));
}

/** 수정 내용을 Realtime Database에 저장하고 편집 모드를 종료합니다. */
async function saveTodoEdit(id, text) {
  await updateTodo(id, text);
  todos = todos.map((todo) => (todo.id === id ? { ...todo, text } : todo));
  editingId = null;
  render();
}

/** 수정 내용을 버리고 편집 모드만 종료합니다. DB에는 쓰지 않습니다. */
function cancelTodoEdit() {
  editingId = null;
  render();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  submitButton.disabled = true;
  try {
    await push(todosRef, {
      text,
      createdAt: Date.now(),
    });
    input.value = "";
  } catch (error) {
    console.error("할일을 추가하지 못했습니다.", error);
    alert("할일을 추가하지 못했습니다. Realtime Database 설정을 확인해 주세요.");
  } finally {
    submitButton.disabled = false;
    input.focus();
  }
});

list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const item = target.closest(".todo-item");
  if (!item) return;

  const id = item.dataset.id;
  if (!id) return;

  if (target.matches("[data-action='edit']")) {
    editingId = id;
    render();
    const editInput = list.querySelector(`[data-id="${id}"] .edit-input`);
    editInput?.focus();
    editInput?.select();
    return;
  }

  if (target.matches("[data-action='cancel']")) {
    cancelTodoEdit();
    return;
  }

  if (target.matches("[data-action='save']")) {
    const editInput = item.querySelector(".edit-input");
    const next = editInput?.value.trim() ?? "";
    if (!next) return;

    const saveButton = item.querySelector("[data-action='save']");
    if (saveButton instanceof HTMLButtonElement) saveButton.disabled = true;

    try {
      await saveTodoEdit(id, next);
    } catch (error) {
      console.error("할일을 수정하지 못했습니다.", error);
      alert("할일을 수정하지 못했습니다. Realtime Database 설정을 확인해 주세요.");
      if (saveButton instanceof HTMLButtonElement) saveButton.disabled = false;
    }
    return;
  }

  if (target.matches("[data-action='delete']")) {
    const deleteButton = target;
    if (deleteButton instanceof HTMLButtonElement) deleteButton.disabled = true;

    try {
      await deleteTodo(id);
      if (editingId === id) editingId = null;
    } catch (error) {
      console.error("할일을 삭제하지 못했습니다.", error);
      alert("할일을 삭제하지 못했습니다. Realtime Database 설정을 확인해 주세요.");
      if (deleteButton instanceof HTMLButtonElement) deleteButton.disabled = false;
    }
  }
});

list.addEventListener("keydown", async (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (!event.target.classList.contains("edit-input")) return;

  const item = event.target.closest(".todo-item");
  const id = item?.dataset.id;
  if (!id) return;

  if (event.key === "Enter") {
    event.preventDefault();
    const next = event.target.value.trim();
    if (!next) return;

    try {
      await saveTodoEdit(id, next);
    } catch (error) {
      console.error("할일을 수정하지 못했습니다.", error);
      alert("할일을 수정하지 못했습니다. Realtime Database 설정을 확인해 주세요.");
    }
  }

  if (event.key === "Escape") {
    cancelTodoEdit();
  }
});

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render() {
  countEl.textContent = `${todos.length}개`;
  emptyState.classList.toggle("hidden", todos.length > 0);

  list.innerHTML = todos
    .map((todo) => {
      if (todo.id === editingId) {
        return `
          <li class="todo-item editing" data-id="${todo.id}">
            <div class="edit-row">
              <input class="edit-input" type="text" value="${escapeHtml(todo.text)}" maxlength="120" aria-label="할일 수정" />
              <div class="todo-actions">
                <button type="button" class="btn btn-primary" data-action="save">저장</button>
                <button type="button" class="btn btn-ghost" data-action="cancel">취소</button>
              </div>
            </div>
          </li>
        `;
      }

      return `
        <li class="todo-item" data-id="${todo.id}">
          <p class="todo-text">${escapeHtml(todo.text)}</p>
          <div class="todo-actions">
            <button type="button" class="btn btn-ghost" data-action="edit">수정</button>
            <button type="button" class="btn btn-danger" data-action="delete">삭제</button>
          </div>
        </li>
      `;
    })
    .join("");
}
