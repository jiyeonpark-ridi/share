// 작은 DOM 도우미와 아이콘 모음. 화면 코드에서 반복되는 부분만 모아 둔다.

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** 템플릿 문자열에 넣는 모든 데이터는 esc()를 거친다. */
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE[c]);

export const $ = (selector, root = document) => root.querySelector(selector);

const svg = (body, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;

export const icons = {
  search: svg('<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', "icon icon--sm"),
  chevron: svg('<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  back: svg('<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', "icon icon--sm"),
  external: svg('<path d="M8 16L16 8M10 8h6v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', "icon icon--sm"),
  panel: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 4.5v15M16 10l-2 2 2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', "icon icon--sm"),
  logo: `<svg class="brand__logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="16" r="9" fill="#1D4ED8"/><circle cx="20" cy="16" r="9" fill="#1D4ED8" fill-opacity="0.32"/></svg>`,
};
