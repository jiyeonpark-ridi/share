// 공통 헤더: 로고 · 메뉴(작업실) · 전체 검색(⌘K).

import { esc, icons } from "./dom.js";
import { homeHref, projectHref, matches, STATUS } from "./data.js";

const MAX_PER_GROUP = 6;

/** getProjects: 최신 목록을 돌려주는 함수 (관리자 모드에서 목록이 바뀌어도 검색이 따라가도록) */
export function mountHeader(root, getProjects) {
  root.innerHTML = `
    <div class="container site-header__inner">
      <a class="brand" href="${homeHref()}">
        ${icons.logo}
        <span class="brand__name">Jiyeon's Handoff Lab</span>
      </a>
      <nav class="site-nav" aria-label="메뉴">
        <a class="site-nav__link" href="${homeHref()}">작업실</a>
      </nav>
      <div class="gsearch">
        <label class="gsearch__field">
          ${icons.search}
          <input class="gsearch__input" type="search" placeholder="검색" aria-label="프로젝트 · 작업물 검색"
                 autocomplete="off" aria-controls="gsearch-panel" aria-expanded="false">
          <kbd class="gsearch__kbd">⌘K</kbd>
        </label>
        <div class="gsearch__panel" id="gsearch-panel" role="listbox" hidden></div>
      </div>
    </div>`;

  setupSearch(root.querySelector(".gsearch"), getProjects);
}

function searchResults(projects, query) {
  const projectHits = projects
    .filter((p) => matches(query, p.name, p.summary))
    .slice(0, MAX_PER_GROUP)
    .map((p) => ({ href: projectHref(p.id), title: p.name, meta: STATUS[p.status].label }));

  const workHits = projects
    .flatMap((p) => p.works.map((w) => ({ p, w })))
    .filter(({ w }) => matches(query, w.title, w.summary, w.type))
    .slice(0, MAX_PER_GROUP)
    .map(({ p, w }) => ({ href: projectHref(p.id, w.id), title: w.title, meta: `${p.name} · ${w.type ?? ""}` }));

  return { projectHits, workHits };
}

function setupSearch(box, getProjects) {
  const input = box.querySelector(".gsearch__input");
  const panel = box.querySelector(".gsearch__panel");
  let activeIndex = -1;

  const items = () => [...panel.querySelectorAll(".gsearch__item")];

  const close = () => {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  };

  const render = () => {
    const query = input.value.trim();
    if (!query) return close();
    const { projectHits, workHits } = searchResults(getProjects(), query);
    const group = (label, hits) =>
      hits.length
        ? `<div class="gsearch__group">${label}</div>` +
          hits.map((h) => `
            <a class="gsearch__item" role="option" href="${esc(h.href)}">
              <span class="gsearch__title">${esc(h.title)}</span>
              <span class="gsearch__meta">${esc(h.meta)}</span>
            </a>`).join("")
        : "";
    panel.innerHTML =
      group("프로젝트", projectHits) + group("작업물", workHits) ||
      `<p class="gsearch__empty">"${esc(query)}"에 맞는 결과가 없어요</p>`;
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    activeIndex = -1;
  };

  const move = (step) => {
    const list = items();
    if (!list.length) return;
    activeIndex = (activeIndex + step + list.length) % list.length;
    list.forEach((el, i) => el.classList.toggle("is-active", i === activeIndex));
    list[activeIndex].scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      const target = items()[activeIndex] ?? items()[0];
      if (target) location.href = target.href;
    } else if (e.key === "Escape") { input.value = ""; close(); input.blur(); }
  });

  document.addEventListener("click", (e) => { if (!box.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}
