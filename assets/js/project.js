// 프로젝트 상세: 프로젝트 | 작업물 | 작업물 영역.
// 주소: project.html?p=<프로젝트 id>&w=<작업물 id>
// 같은 페이지 안에서 이동할 때는 새로고침 없이 주소만 바꾼다 (뒤로가기 지원).

import { $, esc, icons } from "./dom.js";
import { loadProjects, STATUS, STATUS_KEYS, SORTERS, projectHref, homeHref, formatDate, matches } from "./data.js";
import { mountHeader } from "./header.js";
import { toast, copyText } from "./toast.js";
import { setupPanels } from "./panels.js";
import { maybeStartAdmin } from "./admin-gate.js";

const SITE = "Jiyeon's Handoff Lab";

const state = {
  projects: [],
  project: null,
  work: null,
  /** 주소에 w가 있는지. 모바일에서 목록 화면 / 작업물 화면을 가르는 기준 */
  workInUrl: false,
  projectQuery: "",
  workQuery: "",
  workSort: "updated",
};

let panels = null;
/** 관리자로 로그인했을 때만 채워진다 */
let admin = null;

const els = {
  workspace: $("#workspace"),
  projects: $("#project-nav"),
  projectSearch: $("#project-search"),
  works: $("#works-col"),
  viewer: $("#viewer"),
};

/* ---------- state from URL ---------- */

function readUrl() {
  const params = new URLSearchParams(location.search);
  redirectMovedWork(params);
  state.project = state.projects.find((p) => p.id === params.get("p")) ?? null;
  const works = state.project?.works ?? [];
  state.workInUrl = params.has("w");
  state.work = works.find((w) => w.id === params.get("w")) ?? works[0] ?? null;
}

/** 작업물이 다른 프로젝트로 옮겨졌으면 예전 주소를 새 주소로 바꿔 준다 */
function redirectMovedWork(params) {
  const workId = params.get("w");
  if (!workId) return;
  const inProject = state.projects.find((p) => p.id === params.get("p"))?.works.some((w) => w.id === workId);
  if (inProject) return;
  const owner = state.projects.find((p) => p.works.some((w) => w.id === workId));
  if (!owner) return;
  params.set("p", owner.id);
  history.replaceState(null, "", projectHref(owner.id, workId));
}

function navigate(href) {
  history.pushState(null, "", href);
  readUrl();
  render();
}

/* ---------- col 1 : projects ---------- */

function renderProjects() {
  const visible = state.projects.filter((p) => matches(state.projectQuery, p.name));
  const groups = STATUS_KEYS
    .map((key) => [key, visible.filter((p) => p.status === key)])
    .filter(([, list]) => list.length);

  els.projects.innerHTML = groups.length
    ? groups.map(([key, list]) => `
        <div class="pgroup">
          <p class="pgroup__label">${STATUS[key].label}<span>${list.length}</span></p>
          <ul>
            ${list.map((p) => `
              <li>
                <a class="pnav__item${key === "done" ? " is-done" : ""}" href="${esc(projectHref(p.id))}" data-nav
                   ${p === state.project ? 'aria-current="page"' : ""}>
                  <span class="pnav__name">${esc(p.name)}</span>
                  <span class="pnav__count">${p.works.length}</span>
                </a>
              </li>`).join("")}
          </ul>
        </div>`).join("")
    : `<p class="empty">찾는 프로젝트가 없어요</p>`;
}

/* ---------- col 2 : project header + works ---------- */

function renderWorksCol() {
  const p = state.project;
  if (!p) {
    els.works.innerHTML = `
      <div class="phead">
        <a class="phead__back" href="${homeHref()}">${icons.back}작업실</a>
        <p class="phead__name">프로젝트를 찾을 수 없어요</p>
      </div>
      <p class="empty"><a class="btn" href="${homeHref()}">작업실로 돌아가기</a></p>`;
    return;
  }

  const links = p.links
    .map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.label)}">${esc(l.label)}</a>`)
    .join("");

  els.works.innerHTML = `
    <div class="phead">
      <a class="phead__back" href="${homeHref()}">${icons.back}작업실</a>
      <div class="phead__row">
        <h1 class="phead__name">${esc(p.name)}</h1>
        <span class="phead__status status--${p.status}">${STATUS[p.status].label}</span>
        ${admin ? admin.moreButton("project-menu", p.id) : ""}
        <button class="panel-toggle" type="button" data-panel-toggle="works" aria-expanded="true" title="작업물 칸 접기 ( ] )">
          ${icons.panel}<span class="sr-only">작업물 칸 접기</span>
        </button>
      </div>
      ${links ? `<div class="phead__links">${links}</div>` : ""}
    </div>
    <div class="wtools">
      <div class="wtools__row">
        <span class="wtools__count">작업물 ${p.works.length}</span>
        <select class="select" id="work-sort" aria-label="작업물 정렬">
          <option value="updated"${state.workSort === "updated" ? " selected" : ""}>최신순</option>
          <option value="name"${state.workSort === "name" ? " selected" : ""}>이름순</option>
        </select>
      </div>
      <label class="field field--sm">
        ${icons.search}
        <input class="field__input" id="work-search" type="search" placeholder="작업물 찾기" value="${esc(state.workQuery)}" autocomplete="off">
      </label>
    </div>
    <ul class="wlist" id="work-list"></ul>`;

  renderWorkList();
}

function renderWorkList() {
  const list = $("#work-list");
  if (!list) return;
  const p = state.project;
  const sorter = state.workSort === "name" ? SORTERS.name : (a, b) => (b.date || "").localeCompare(a.date || "");
  const visible = p.works.filter((w) => matches(state.workQuery, w.title, w.type, w.summary)).sort(sorter);

  if (!p.works.length) {
    list.innerHTML = `<li class="empty">아직 올라온 작업물이 없어요</li>`;
    return;
  }
  list.innerHTML = visible.length
    ? visible.map((w) => `
        <li class="work-item">
          <a class="witem" href="${esc(projectHref(p.id, w.id))}" data-nav ${w === state.work ? 'aria-current="true"' : ""}>
            <span class="witem__body">
              <span class="witem__title">${esc(w.title)}</span>
              <span class="witem__meta">${esc([w.type, formatDate(w.date)].filter(Boolean).join("  ·  "))}</span>
            </span>
            ${icons.chevron}
          </a>
          ${admin ? admin.moreButton("work-menu", p.id, w.id) : ""}
        </li>`).join("")
    : `<li class="empty">찾는 작업물이 없어요</li>`;
}

/* ---------- col 3 : viewer ---------- */

function renderViewer() {
  const { project: p, work: w } = state;
  if (!p || !w) {
    els.viewer.innerHTML = `
      <div class="stage">
        <div class="stage__placeholder">
          ${p ? "아직 올라온 작업물이 없어요" : "프로젝트를 골라 주세요"}
          <small>작업물이 올라오면 여기서 바로 확인할 수 있어요</small>
        </div>
      </div>`;
    return;
  }

  // 같은 작업물이면 iframe을 다시 불러오지 않는다
  const frame = els.viewer.querySelector(".stage__frame");
  if (frame && frame.dataset.src === w.src) {
    updateViewerBar(p, w);
    return;
  }

  els.viewer.innerHTML = `
    <div class="vbar">
      <a class="vbar__back" href="${esc(projectHref(p.id))}" data-nav>${icons.back}작업물</a>
      <div class="vbar__text">
        <h2 class="vbar__title"></h2>
        <p class="vbar__meta"></p>
      </div>
      <button class="btn" type="button" id="copy-link">링크 복사</button>
      <a class="btn btn--primary" id="open-new" target="_blank" rel="noopener">새 창으로 ${icons.external}</a>
    </div>
    <div class="stage">
      <div class="stage__loading">불러오는 중…</div>
      <iframe class="stage__frame" data-src="${esc(w.src)}" src="${esc(w.src)}" title="${esc(w.title)}" loading="lazy"></iframe>
    </div>`;

  const iframe = els.viewer.querySelector(".stage__frame");
  iframe.addEventListener("load", () => els.viewer.querySelector(".stage__loading")?.remove(), { once: true });
  updateViewerBar(p, w);
}

function updateViewerBar(p, w) {
  els.viewer.querySelector(".vbar__title").textContent = w.title;
  els.viewer.querySelector(".vbar__meta").textContent = w.date ? `${formatDate(w.date)} 업데이트` : "";
  els.viewer.querySelector("#open-new").href = w.src;
  els.viewer.querySelector(".vbar__back").href = projectHref(p.id);
}

/* ---------- render ---------- */

function render() {
  const { project: p, work: w } = state;
  document.title = [w?.title, p?.name, SITE].filter(Boolean).join(" · ");
  els.workspace.dataset.view = p && w && state.workInUrl ? "work" : "list";
  renderProjects();
  renderWorksCol();
  renderViewer();
  panels?.refresh();
}

/* ---------- events ---------- */

function bindEvents() {
  // 같은 페이지 안 이동 (프로젝트 · 작업물 · 뒤로)
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-nav]");
    if (e.target.closest(".a-inline, [data-admin]")) return; // 관리자 편집 중에는 이동하지 않음
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (link.href !== location.href) navigate(link.href);
  });
  window.addEventListener("popstate", () => { readUrl(); render(); });

  els.projectSearch.addEventListener("input", () => {
    state.projectQuery = els.projectSearch.value;
    renderProjects();
  });

  els.works.addEventListener("input", (e) => {
    if (e.target.id !== "work-search") return;
    state.workQuery = e.target.value;
    renderWorkList();
  });
  els.works.addEventListener("change", (e) => {
    if (e.target.id !== "work-sort") return;
    state.workSort = e.target.value;
    renderWorkList();
  });

  els.viewer.addEventListener("click", async (e) => {
    if (!e.target.closest("#copy-link")) return;
    const url = projectHref(state.project.id, state.work.id);
    toast((await copyText(url)) ? "링크를 복사했어요" : "복사하지 못했어요");
  });
}

async function init() {
  try {
    state.projects = await loadProjects();
  } catch (err) {
    els.works.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  }
  mountHeader($("#site-header"), () => state.projects);
  readUrl();
  render();
  panels = setupPanels(els.workspace);
  bindEvents();

  admin = await maybeStartAdmin({ onChange: applyAdminChange });
  if (admin) applyAdminChange(admin.projects);
}

/** 관리자 저장 후 화면 갱신. 보던 프로젝트가 삭제됐으면 홈으로 */
function applyAdminChange(projects, ctx = {}) {
  state.projects = projects;
  if (ctx.deletedProject && ctx.deletedProject === state.project?.id) {
    location.href = homeHref();
    return;
  }
  readUrl();
  render();
}

init();
