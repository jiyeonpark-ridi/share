// data/projects.json을 읽어서 화면에서 바로 쓰기 좋은 모양으로 정리한다.
// 새 프로젝트 · 작업물 추가는 JSON만 고치면 된다 (README 참고).

/** 사이트 루트. GitHub Pages 하위 경로(/share/)에서도 맞게 동작한다. */
const ROOT = new URL("../../", import.meta.url);

export const STATUS = {
  active: { label: "진행중" },
  planned: { label: "진행예정" },
  done: { label: "완료" },
};
export const STATUS_KEYS = Object.keys(STATUS);

export const SORTERS = {
  updated: (a, b) => (b.updated || "").localeCompare(a.updated || ""),
  name: (a, b) => (a.name ?? a.title).localeCompare(b.name ?? b.title, "ko"),
};

export const homeHref = () => ROOT.href;

export function projectHref(projectId, workId) {
  const url = new URL("project.html", ROOT);
  url.searchParams.set("p", projectId);
  if (workId) url.searchParams.set("w", workId);
  return url.href;
}

/** "2026-10-14" → "2026.10.14" */
export const formatDate = (iso) => (iso ? iso.replaceAll("-", ".") : "");

/** 리스트에 보여줄 날짜. 작업물이 없는 진행예정 프로젝트는 시작일을 보여준다. */
export function dateLabel(project) {
  if (!project.works.length && project.start) return `${formatDate(project.start)} 시작`;
  return formatDate(project.updated);
}

function normalizeWork(project, work) {
  return {
    ...work,
    // url이 있으면 외부 주소, 없으면 works/<프로젝트>/<작업물>/index.html
    src: work.url || new URL(`works/${project.id}/${work.id}/`, ROOT).href,
  };
}

function normalizeProject(project) {
  const works = (project.works ?? [])
    .map((work) => normalizeWork(project, work))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return {
    ...project,
    status: STATUS[project.status] ? project.status : "active",
    works,
    links: (project.links ?? []).filter((link) => link.label && link.url),
    updated: works[0]?.date || project.updated || project.start || "",
  };
}

export async function loadProjects() {
  const res = await fetch(new URL("data/projects.json", ROOT), { cache: "no-cache" });
  if (!res.ok) throw new Error(`projects.json을 불러오지 못했어요 (${res.status})`);
  const { projects = [] } = await res.json();
  return projects.map(normalizeProject).sort(SORTERS.updated);
}

export const matches = (query, ...fields) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((field) => String(field ?? "").toLowerCase().includes(q));
};
