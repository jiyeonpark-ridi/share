// 홈: 상태 필터 + 프로젝트 검색 · 정렬 + 리스트.

import { $, esc, icons } from "./dom.js";
import { loadProjects, STATUS, STATUS_KEYS, SORTERS, projectHref, dateLabel, matches } from "./data.js";
import { mountHeader } from "./header.js";
import { maybeStartAdmin } from "./admin-gate.js";

const params = new URLSearchParams(location.search);
const state = {
  projects: [],
  status: STATUS_KEYS.includes(params.get("status")) ? params.get("status") : "all",
  query: "",
  sort: "updated",
};

/** 관리자로 로그인했을 때만 채워진다 (⋯ 버튼 · + 새 프로젝트) */
let admin = null;

const els = {
  filter: $("#status-filter"),
  search: $("#project-search"),
  sort: $("#project-sort"),
  count: $("#project-count"),
  list: $("#project-list"),
};

function renderFilter() {
  const count = (key) => (key === "all" ? state.projects.length : state.projects.filter((p) => p.status === key).length);
  const options = [["all", "전체"], ...STATUS_KEYS.map((key) => [key, STATUS[key].label])];
  els.filter.innerHTML = options
    .map(([key, label]) => `
      <li>
        <button class="filter__item" type="button" data-status="${key}" aria-pressed="${state.status === key}">
          <span>${label}</span><span class="filter__count">${count(key)}</span>
        </button>
      </li>`)
    .join("");
}

function projectRow(p) {
  const status = STATUS[p.status].label;
  const works = p.works.length ? `작업물 ${p.works.length}` : "—";
  return `
    <li class="project-item">
      <a class="project-row${p.status === "done" ? " is-done" : ""}" href="${esc(projectHref(p.id))}">
        <span class="project-row__name">${esc(p.name)}</span>
        <span class="project-row__status status status--${p.status}">${status}</span>
        <span class="project-row__count">${works}</span>
        <span class="project-row__date">${esc(dateLabel(p))}</span>
        <span class="project-row__meta"><span class="status status--${p.status}">${status}</span> · ${works} · ${esc(dateLabel(p))}</span>
        ${icons.chevron}
      </a>
      ${admin ? admin.moreButton("project-menu", p.id) : ""}
    </li>`;
}

function renderList() {
  const visible = state.projects
    .filter((p) => state.status === "all" || p.status === state.status)
    .filter((p) => matches(state.query, p.name, p.summary))
    .sort(SORTERS[state.sort]);

  const label = state.status === "all" ? "프로젝트" : `${STATUS[state.status].label}인 프로젝트`;
  els.count.textContent = `${label} ${visible.length}개`;
  els.list.innerHTML = visible.length
    ? visible.map(projectRow).join("")
    : `<li class="empty">조건에 맞는 프로젝트가 없어요</li>`;
}

function syncUrl() {
  const url = new URL(location.href);
  if (state.status === "all") url.searchParams.delete("status");
  else url.searchParams.set("status", state.status);
  history.replaceState(null, "", url);
}

function bindEvents() {
  els.filter.addEventListener("click", (e) => {
    const button = e.target.closest("[data-status]");
    if (!button) return;
    state.status = button.dataset.status;
    syncUrl();
    renderFilter();
    renderList();
  });
  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    renderList();
  });
  els.sort.addEventListener("change", () => {
    state.sort = els.sort.value;
    renderList();
  });
}

async function init() {
  try {
    state.projects = await loadProjects();
  } catch (err) {
    els.list.innerHTML = `<li class="empty">${esc(err.message)}</li>`;
    return;
  }
  mountHeader($("#site-header"), () => state.projects);
  renderFilter();
  renderList();
  bindEvents();

  admin = await maybeStartAdmin({
    onChange: (projects) => {
      state.projects = projects;
      renderFilter();
      renderList();
    },
  });
  if (admin) {
    // 관리자 화면은 GitHub에서 바로 읽은 최신 목록을 쓴다
    state.projects = admin.projects;
    els.sort.insertAdjacentHTML("beforebegin", admin.newProjectButton());
    renderFilter();
    renderList();
  }
}

init();
