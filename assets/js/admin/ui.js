// 관리자 화면 부품: 가운데 창(모달) · 드롭다운 메뉴 · 그 자리 편집.

import { esc } from "../dom.js";

/* ---------- modal ---------- */

/**
 * onSubmit(form)이 끝나면 창이 닫힌다. 오류를 던지면 메시지를 창 안에 보여준다.
 * onClose(saved)는 창이 닫힐 때 호출된다.
 */
export function openModal({ title, body, submitLabel = "저장", tone = "dark", note = "", width = 480, onSubmit, onOpen, onClose }) {
  const overlay = document.createElement("div");
  overlay.className = "a-overlay";
  overlay.innerHTML = `
    <form class="a-modal" style="width: min(${width}px, 100%)" novalidate>
      <div class="a-modal__head">
        <h2 class="a-modal__title">${esc(title)}</h2>
        <button type="button" class="a-modal__close" data-close aria-label="닫기">✕</button>
      </div>
      <div class="a-modal__body">${body}</div>
      <p class="a-modal__error" role="alert" hidden></p>
      <div class="a-modal__foot">
        <span class="a-modal__note">${esc(note)}</span>
        <button type="button" class="btn" data-close>취소</button>
        <button type="submit" class="btn ${tone === "danger" ? "btn--danger" : "btn--dark"}">${esc(submitLabel)}</button>
      </div>
    </form>`;
  document.body.append(overlay);
  document.body.classList.add("a-lock");

  const form = overlay.querySelector("form");
  const submit = form.querySelector('[type="submit"]');
  const errorEl = form.querySelector(".a-modal__error");
  let saved = false;

  const onKey = (e) => { if (e.key === "Escape") close(); };
  function close() {
    overlay.remove();
    document.body.classList.remove("a-lock");
    document.removeEventListener("keydown", onKey);
    onClose?.(saved);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    errorEl.hidden = true;
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = "저장 중…";
    try {
      await onSubmit(form);
      saved = true;
      close();
    } catch (err) {
      errorEl.textContent = err.message || "저장하지 못했어요. 다시 시도해 주세요";
      errorEl.hidden = false;
      submit.disabled = false;
      submit.textContent = label;
    }
  });

  onOpen?.(form, { submit });
  form.querySelector("input:not([type=radio]), textarea")?.focus();
  return { form, close };
}

export const field = (label, control, hint = "") => `
  <label class="a-field">
    <span class="a-field__label">${esc(label)}${hint ? `<span class="a-field__hint">${esc(hint)}</span>` : ""}</span>
    ${control}
  </label>`;

/* ---------- dropdown menu ---------- */

let openMenuEl = null;

export function closeMenu() {
  openMenuEl?.remove();
  openMenuEl = null;
}

/**
 * items: [{ label, danger?, onSelect } | { label, children: [{ label, checked?, onSelect }] }]
 */
export function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "a-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = items.map((item, i) => {
    if (item.children) {
      return `
        <button type="button" class="a-menu__item" data-i="${i}" aria-expanded="false">${esc(item.label)}<span class="a-menu__caret">›</span></button>
        <div class="a-menu__sub" hidden>
          ${item.children.map((c, j) => `
            <button type="button" class="a-menu__item a-menu__subitem${c.checked ? " is-checked" : ""}" data-i="${i}" data-j="${j}">${esc(c.label)}</button>`).join("")}
        </div>`;
    }
    return `${item.danger ? '<div class="a-menu__sep"></div>' : ""}
      <button type="button" class="a-menu__item${item.danger ? " is-danger" : ""}" data-i="${i}">${esc(item.label)}</button>`;
  }).join("");
  document.body.append(menu);
  openMenuEl = menu;

  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + 6 + menu.offsetHeight > innerHeight ? rect.top - menu.offsetHeight - 6 : rect.bottom + 6;
  menu.style.top = `${Math.max(8, top)}px`;
  menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth))}px`;

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".a-menu__item");
    if (!btn) return;
    const item = items[btn.dataset.i];
    if (btn.dataset.j !== undefined) { closeMenu(); item.children[btn.dataset.j].onSelect(); return; }
    if (item.children) {
      const sub = btn.nextElementSibling;
      sub.hidden = !sub.hidden;
      btn.setAttribute("aria-expanded", String(!sub.hidden));
      return;
    }
    closeMenu();
    item.onSelect();
  });
  menu.querySelector(".a-menu__item")?.focus();
}

document.addEventListener("click", (e) => {
  if (openMenuEl && !openMenuEl.contains(e.target) && !e.target.closest("[data-admin]")) closeMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
window.addEventListener("resize", closeMenu);

/* ---------- inline edit ---------- */

/** target 글자를 입력칸으로 바꾼다. Enter = 저장, Esc = 취소 */
export function inlineEdit(target, { value, onSave }) {
  const wrap = document.createElement("span");
  wrap.className = "a-inline";
  wrap.innerHTML = `<input class="a-inline__input" value="${esc(value)}" aria-label="새 제목"><button type="button" class="a-inline__save">저장</button>`;
  target.replaceWith(wrap);
  const input = wrap.querySelector("input");
  input.focus();
  input.select();

  let done = false;
  const restore = () => { if (!done) { done = true; wrap.replaceWith(target); } };
  const save = async () => {
    const next = input.value.trim();
    if (!next || next === value) return restore();
    input.disabled = true;
    try {
      done = true;
      await onSave(next);
    } catch {
      done = false;
      input.disabled = false;
      input.focus();
    }
  };

  wrap.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (e.target.closest(".a-inline__save")) save(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); restore(); }
  });
  input.addEventListener("blur", () => setTimeout(() => { if (!input.disabled && document.activeElement !== wrap.querySelector("button")) restore(); }, 150));
}
