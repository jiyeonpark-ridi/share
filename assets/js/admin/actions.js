// 관리자 동작: 프로젝트 만들기 · 수정 · 상태 · 삭제, 작업물 제목 · 옮기기 · 삭제.
// 모든 동작은 store.save()로 커밋하고, 끝나면 onChange로 화면을 다시 그린다.

import { esc } from "../dom.js";
import { STATUS, STATUS_KEYS } from "../data.js";
import { toast } from "../toast.js";
import { deleteDir, moveDir } from "./github.js";
import { WORKS_DIR } from "./config.js";
import { openModal, field, inlineEdit } from "./ui.js";

const findProject = (raw, id) => {
  const p = raw.projects.find((x) => x.id === id);
  if (!p) throw new Error("다른 곳에서 삭제된 프로젝트예요. 새로고침해 주세요");
  return p;
};
const findWork = (project, id) => {
  const w = (project.works ?? []).find((x) => x.id === id);
  if (!w) throw new Error("다른 곳에서 삭제된 작업물이에요. 새로고침해 주세요");
  return w;
};

/** 주소에 쓸 영문 id. 이름에 영문이 없으면 짧은 무작위 id */
function makeId(name, taken, prefix) {
  const ascii = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let base = ascii.length >= 3 ? ascii.slice(0, 40) : `${prefix}-${Date.now().toString(36).slice(-5)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/* ---------- project form ---------- */

const linkRow = (link = { label: "", url: "" }) => `
  <div class="a-link" draggable="true">
    <span class="a-link__handle" title="끌어서 순서 바꾸기" aria-hidden="true">⋮⋮</span>
    <input class="a-input a-link__label" placeholder="이름 (예: PRD)" value="${esc(link.label)}" maxlength="20">
    <input class="a-input a-link__url" placeholder="https://" value="${esc(link.url)}" inputmode="url">
    <button type="button" class="a-link__del" aria-label="링크 삭제">✕</button>
  </div>`;

function projectFormBody(p) {
  const status = p?.status ?? "active";
  return `
    ${field("이름", `<input class="a-input" name="name" required maxlength="40" value="${esc(p?.name ?? "")}">`)}
    ${field("한 줄 설명", `<input class="a-input" name="summary" maxlength="80" value="${esc(p?.summary ?? "")}">`)}
    <div class="a-field">
      <span class="a-field__label">상태</span>
      <div class="a-seg" role="radiogroup">
        ${STATUS_KEYS.map((key) => `
          <label class="a-seg__opt"><input type="radio" name="status" value="${key}"${key === status ? " checked" : ""}><span>${STATUS[key].label}</span></label>`).join("")}
      </div>
    </div>
    ${field("시작일", `<input class="a-input" type="date" name="start" value="${esc(p?.start ?? "")}">`, "선택")}
    <div class="a-field">
      <span class="a-field__label">링크 칩<span class="a-field__hint">선택 · 작업물 칸에 칩으로 보여요</span></span>
      <div class="a-links">${(p?.links ?? []).map(linkRow).join("")}</div>
      <button type="button" class="a-add-link">+ 링크 추가</button>
    </div>`;
}

function bindLinkEditor(form) {
  const list = form.querySelector(".a-links");
  form.querySelector(".a-add-link").addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", linkRow());
    list.lastElementChild.querySelector("input").focus();
  });
  list.addEventListener("click", (e) => { if (e.target.closest(".a-link__del")) e.target.closest(".a-link").remove(); });

  let dragging = null;
  list.addEventListener("dragstart", (e) => {
    dragging = e.target.closest(".a-link");
    dragging?.classList.add("is-dragging");
  });
  list.addEventListener("dragend", () => { dragging?.classList.remove("is-dragging"); dragging = null; });
  list.addEventListener("dragover", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const over = e.target.closest(".a-link");
    if (!over || over === dragging) return;
    const { top, height } = over.getBoundingClientRect();
    over[e.clientY < top + height / 2 ? "before" : "after"](dragging);
  });
}

function readProjectForm(form) {
  const f = form.elements;
  const name = f.namedItem("name").value.trim();
  if (!name) throw new Error("프로젝트 이름을 입력해 주세요");
  const links = [...form.querySelectorAll(".a-link")]
    .map((row) => ({ label: row.querySelector(".a-link__label").value.trim(), url: row.querySelector(".a-link__url").value.trim() }))
    .filter((l) => l.label || l.url);
  for (const l of links) {
    if (!l.label || !/^https?:\/\/\S+$/.test(l.url)) throw new Error(`링크 "${l.label || l.url}"의 이름과 주소(https://…)를 확인해 주세요`);
  }
  return {
    name,
    summary: f.namedItem("summary").value.trim(),
    status: f.namedItem("status").value,
    start: f.namedItem("start").value || undefined,
    links,
  };
}

/* ---------- actions ---------- */

export function createActions(store, onChange) {
  const commit = async (change) => {
    const ctx = await store.save(change);
    onChange(store.projects, ctx);
    return ctx;
  };
  const fail = (err) => toast(err.message || "저장하지 못했어요", { duration: 4000 });

  return {
    newProject() {
      openModal({
        title: "새 프로젝트",
        submitLabel: "만들기",
        width: 540,
        note: "저장하면 약 1분 뒤 사이트에 반영돼요",
        body: projectFormBody(null),
        onOpen: bindLinkEditor,
        onSubmit: (form) => {
          const values = readProjectForm(form);
          return commit({
            message: `프로젝트 추가 – ${values.name}`,
            mutate: (raw) => {
              const id = makeId(values.name, new Set(raw.projects.map((p) => p.id)), "project");
              raw.projects.unshift({ id, ...values, works: [] });
              return { projectId: id };
            },
          });
        },
      });
    },

    editProject(id) {
      const p = store.raw.projects.find((x) => x.id === id);
      openModal({
        title: "프로젝트 수정",
        width: 540,
        note: "저장하면 약 1분 뒤 사이트에 반영돼요",
        body: projectFormBody(p),
        onOpen: bindLinkEditor,
        onSubmit: (form) => {
          const values = readProjectForm(form);
          return commit({
            message: `프로젝트 수정 – ${values.name}`,
            mutate: (raw) => {
              const target = findProject(raw, id);
              Object.assign(target, values);
              if (!values.start) delete target.start;
            },
          });
        },
      });
    },

    setStatus(id, status) {
      const p = store.raw.projects.find((x) => x.id === id);
      commit({
        message: `상태 변경 – ${p?.name}: ${STATUS[status].label}`,
        mutate: (raw) => { findProject(raw, id).status = status; },
      }).catch(fail);
    },

    deleteProject(id) {
      const p = store.raw.projects.find((x) => x.id === id);
      const count = p.works?.length ?? 0;
      openModal({
        title: "프로젝트를 삭제할까요?",
        submitLabel: "삭제",
        tone: "danger",
        body: `
          <div class="a-warn">
            <strong>"${esc(p.name)}"${count ? `과 안의 작업물 ${count}개가` : "가"} 함께 삭제돼요.</strong>
            <span>공유했던 링크도 더 이상 열리지 않아요. 커밋 기록에는 남아서 복구 요청은 가능해요.</span>
          </div>
          ${field("확인을 위해 프로젝트 이름을 입력하세요", `<input class="a-input" name="confirm" autocomplete="off" placeholder="${esc(p.name)}">`)}`,
        onOpen: (form, { submit }) => {
          submit.disabled = true;
          const input = form.elements.namedItem("confirm");
          input.addEventListener("input", () => { submit.disabled = input.value.trim() !== p.name; });
        },
        onSubmit: () => commit({
          message: `프로젝트 삭제 – ${p.name}`,
          mutate: (raw) => { raw.projects = raw.projects.filter((x) => x.id !== id); return { deletedProject: id }; },
          files: (snapshot) => deleteDir(snapshot, `${WORKS_DIR}/${id}`),
        }),
      });
    },

    renameWork(projectId, workId, titleEl) {
      const w = store.raw.projects.find((x) => x.id === projectId)?.works.find((x) => x.id === workId);
      inlineEdit(titleEl, {
        value: w.title,
        onSave: (title) => commit({
          message: `작업물 제목 수정 – ${title}`,
          mutate: (raw) => { findWork(findProject(raw, projectId), workId).title = title; },
        }).catch((err) => { fail(err); throw err; }),
      });
    },

    moveWork(projectId, workId) {
      const from = store.raw.projects.find((x) => x.id === projectId);
      const w = from.works.find((x) => x.id === workId);
      const options = store.projects.map((p) => `
        <label class="a-choice${p.id === projectId ? " is-current" : ""}">
          <input type="radio" name="target" value="${esc(p.id)}"${p.id === projectId ? " disabled" : ""}>
          <span class="a-choice__name">${esc(p.name)}</span>
          <span class="a-choice__meta">${STATUS[p.status].label}${p.id === projectId ? " · 현재 위치" : ""}</span>
        </label>`).join("");
      openModal({
        title: "다른 프로젝트로 옮기기",
        submitLabel: "옮기기",
        width: 460,
        body: `<p class="a-text">"${esc(w.title)}"을 옮길 프로젝트를 골라주세요. 예전 링크는 새 위치로 자동 연결돼요.</p><div class="a-choices">${options}</div>`,
        onSubmit: (form) => {
          const toId = form.elements.namedItem("target").value;
          if (!toId) throw new Error("옮길 프로젝트를 골라주세요");
          return commit({
            message: `작업물 이동 – ${w.title}`,
            mutate: (raw) => {
              const src = findProject(raw, projectId);
              const dst = findProject(raw, toId);
              const work = findWork(src, workId);
              src.works = src.works.filter((x) => x !== work);
              const taken = new Set((dst.works ?? []).map((x) => x.id));
              const newId = taken.has(work.id) ? makeId(work.id, taken, "work") : work.id;
              (dst.works ??= []).unshift({ ...work, id: newId });
              return { movedTo: toId, workId: newId };
            },
            files: (snapshot, ctx) => moveDir(snapshot, `${WORKS_DIR}/${projectId}/${workId}`, `${WORKS_DIR}/${ctx.movedTo}/${ctx.workId}`),
          });
        },
      });
    },

    deleteWork(projectId, workId) {
      const w = store.raw.projects.find((x) => x.id === projectId)?.works.find((x) => x.id === workId);
      openModal({
        title: "작업물을 삭제할까요?",
        submitLabel: "삭제",
        tone: "danger",
        width: 440,
        body: `<div class="a-warn"><strong>"${esc(w.title)}"이 삭제돼요.</strong><span>공유했던 링크도 더 이상 열리지 않아요. 커밋 기록에는 남아요.</span></div>`,
        onSubmit: () => commit({
          message: `작업물 삭제 – ${w.title}`,
          mutate: (raw) => {
            const p = findProject(raw, projectId);
            p.works = (p.works ?? []).filter((x) => x.id !== workId);
          },
          files: (snapshot) => deleteDir(snapshot, `${WORKS_DIR}/${projectId}/${workId}`),
        }),
      });
    },
  };
}
