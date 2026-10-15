// 상세 화면의 왼쪽 두 칸(프로젝트 · 작업물) 폭 조절과 접기/펴기.
// - 경계선 드래그로 폭 조절, 더블클릭하면 기본 폭으로
// - 칸 머리의 버튼 또는 [ / ] 키로 접기 · 펴기
// - 상태는 localStorage에 저장 (없거나 막혀 있어도 정상 동작)
// 모바일(한 칸씩 보기)에서는 CSS가 이 설정을 무시한다.

const STORAGE_KEY = "handoff-lab:panels";
const RAIL_W = 44;
const STEP = 16;

const PANELS = {
  projects: { min: 180, max: 420, key: "[" },
  works: { min: 240, max: 560, key: "]" },
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 저장이 막혀 있으면 이번 방문 동안만 유지 */
  }
}

const clamp = (value, { min, max }) => Math.min(max, Math.max(min, value));
const isTyping = (el) => el.closest("input, textarea, select, [contenteditable]");

export function setupPanels(workspace) {
  const state = load();
  const cols = Object.fromEntries(
    Object.keys(PANELS).map((name) => [name, workspace.querySelector(`[data-panel="${name}"]`)]),
  );

  /** CSS 기본값(반응형 포함)에서 지금 폭을 읽는다 */
  const defaultWidth = (name) =>
    parseFloat(getComputedStyle(workspace).getPropertyValue(`--w-${name}-default`)) || PANELS[name].min;

  function apply(name) {
    const col = cols[name];
    const s = state[name] ?? {};
    const collapsed = Boolean(s.collapsed);
    const width = s.width ? clamp(s.width, PANELS[name]) : null;

    col.classList.toggle("is-collapsed", collapsed);
    if (collapsed) workspace.style.setProperty(`--w-${name}`, `${RAIL_W}px`);
    else if (width) workspace.style.setProperty(`--w-${name}`, `${width}px`);
    else workspace.style.removeProperty(`--w-${name}`);

    col.querySelectorAll("[data-panel-toggle]").forEach((btn) => btn.setAttribute("aria-expanded", String(!collapsed)));
    const handle = col.querySelector(".col__resizer");
    handle.hidden = collapsed;
    handle.setAttribute("aria-valuenow", String(Math.round(width ?? defaultWidth(name))));
  }

  function update(name, patch) {
    state[name] = { ...state[name], ...patch };
    apply(name);
    save(state);
  }

  const toggle = (name) => update(name, { collapsed: !state[name]?.collapsed });

  /* ---------- resize ---------- */
  function bindResizer(name) {
    const col = cols[name];
    const handle = col.querySelector(".col__resizer");
    handle.setAttribute("aria-valuemin", String(PANELS[name].min));
    handle.setAttribute("aria-valuemax", String(PANELS[name].max));

    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = col.getBoundingClientRect().width;
      document.body.classList.add("is-resizing");

      const onMove = (ev) => {
        const width = clamp(startW + ev.clientX - startX, PANELS[name]);
        workspace.style.setProperty(`--w-${name}`, `${width}px`);
        state[name] = { ...state[name], width };
      };
      const onUp = () => {
        document.body.classList.remove("is-resizing");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        update(name, {});
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });

    handle.addEventListener("dblclick", () => update(name, { width: null }));

    handle.addEventListener("keydown", (e) => {
      const delta = e.key === "ArrowLeft" ? -STEP : e.key === "ArrowRight" ? STEP : 0;
      if (!delta) return;
      e.preventDefault();
      const current = state[name]?.width ?? col.getBoundingClientRect().width;
      update(name, { width: clamp(current + delta, PANELS[name]) });
    });
  }

  /* ---------- events ---------- */
  workspace.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-panel-toggle]");
    if (toggleBtn) return toggle(toggleBtn.dataset.panelToggle);
    const rail = e.target.closest(".col__rail");
    if (rail) toggle(rail.closest("[data-panel]").dataset.panel);
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const name = Object.keys(PANELS).find((n) => PANELS[n].key === e.key);
    if (name) toggle(name);
  });

  Object.keys(PANELS).forEach((name) => {
    bindResizer(name);
    apply(name);
  });

  /** 칸 내용이 다시 그려진 뒤(접기 버튼이 새로 생김) aria 상태를 맞춘다 */
  return { refresh: () => Object.keys(PANELS).forEach(apply) };
}
