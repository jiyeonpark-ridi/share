// 관리자 모드 진입점.
// - 주소에 ?admin 을 붙여 접속하면 토큰 등록 창이 뜬다.
// - 토큰은 이 브라우저(localStorage)에만 저장되고, 이후에는 자동으로 관리자 모드가 된다.
// - 토큰이 없으면 아무것도 하지 않고 null을 돌려준다 (팀원 화면은 그대로).

import { esc } from "../dom.js";
import { STATUS, STATUS_KEYS } from "../data.js";
import { toast } from "../toast.js";
import { TOKEN_KEY, REPO } from "./config.js";
import { GitHubRepo, GitHubError } from "./github.js";
import { AdminStore } from "./store.js";
import { createActions } from "./actions.js";
import { openModal, openMenu, field } from "./ui.js";

const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const saveToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* 저장 불가: 이번 방문만 */ } };
const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ } };

function injectStyles() {
  if (document.querySelector("link[data-admin-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/admin.css", import.meta.url).href;
  link.dataset.adminCss = "";
  document.head.append(link);
}

function promptLogin() {
  return new Promise((resolve) => {
    let token = null;
    openModal({
      title: "관리자 로그인",
      submitLabel: "확인하고 로그인",
      width: 500,
      body: `
        <p class="a-text">이 브라우저에 GitHub 토큰을 한 번 등록하면 다음부터는 자동으로 관리자 모드가 돼요. 토큰은 이 브라우저에만 저장돼요.</p>
        ${field("GitHub 토큰", '<input class="a-input" name="token" type="password" autocomplete="off" placeholder="github_pat_…">', "이 레포 전용 · Contents 읽기/쓰기")}
        <div class="a-guide">
          <strong>토큰 발급 방법</strong>
          <ol>
            <li>GitHub → Settings → Developer settings → <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained tokens</a></li>
            <li>Repository access: <b>${esc(`${REPO.owner}/${REPO.repo}`)}</b> 만 선택</li>
            <li>Permissions: <b>Contents → Read and write</b> · 만료는 1년 추천</li>
            <li>만든 토큰을 위 칸에 붙여넣기</li>
          </ol>
        </div>`,
      onSubmit: async (form) => {
        const value = form.elements.namedItem("token").value.trim();
        if (!value) throw new Error("토큰을 붙여넣어 주세요");
        try {
          await new GitHubRepo(value).checkAccess();
        } catch (err) {
          throw new Error(err.status === 401 ? "올바르지 않거나 만료된 토큰이에요" : err.message || "확인하지 못했어요");
        }
        saveToken(value);
        token = value;
      },
      onClose: () => resolve(token),
    });
  });
}

function mountBadge(onLogout) {
  const search = document.querySelector(".site-header .gsearch");
  if (!search) return;
  const badge = document.createElement("div");
  badge.className = "a-badge";
  badge.innerHTML = '<span class="a-badge__dot"></span>관리자<button type="button" class="a-badge__logout">로그아웃</button>';
  search.before(badge);
  badge.querySelector("button").addEventListener("click", onLogout);
}

/** 화면 코드가 템플릿에 끼워 넣는 ⋯ 버튼 */
export const moreButton = (kind, projectId, workId = "") =>
  `<button type="button" class="a-more" data-admin="${kind}" data-project="${esc(projectId)}" data-work="${esc(workId)}" aria-label="관리 메뉴">⋯</button>`;

function bindMenus(actions, store) {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-admin]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const { admin: kind, project, work } = btn.dataset;

    if (kind === "new-project") return actions.newProject();
    if (kind === "project-menu") {
      const current = store.raw.projects.find((p) => p.id === project)?.status;
      return openMenu(btn, [
        { label: "프로젝트 수정", onSelect: () => actions.editProject(project) },
        { label: "상태 바꾸기", children: STATUS_KEYS.map((key) => ({ label: STATUS[key].label, checked: key === current, onSelect: () => actions.setStatus(project, key) })) },
        { label: "프로젝트 삭제", danger: true, onSelect: () => actions.deleteProject(project) },
      ]);
    }
    if (kind === "work-menu") {
      const titleEl = btn.closest("li")?.querySelector(".witem__title");
      return openMenu(btn, [
        { label: "제목 수정", onSelect: () => actions.renameWork(project, work, titleEl) },
        { label: "다른 프로젝트로 옮기기", onSelect: () => actions.moveWork(project, work) },
        { label: "작업물 삭제", danger: true, onSelect: () => actions.deleteWork(project, work) },
      ]);
    }
  }, true);
}

/**
 * @param {{ onChange: (projects, ctx) => void }} options
 * @returns {Promise<null | { projects, moreButton, newProjectButton }>}
 */
export async function startAdmin({ onChange }) {
  const url = new URL(location.href);
  const wantsLogin = url.searchParams.has("admin");
  if (wantsLogin) {
    url.searchParams.delete("admin");
    history.replaceState(history.state, "", url);
  }

  let token = readToken();
  if (!token && !wantsLogin) return null;

  injectStyles();
  if (!token) token = await promptLogin();
  if (!token) return null;

  const repo = new GitHubRepo(token);
  try {
    await repo.checkAccess();
  } catch (err) {
    if (err instanceof GitHubError && [401, 403].includes(err.status)) {
      clearToken();
      toast("관리자 토큰이 만료됐거나 권한이 없어요. 주소 뒤에 ?admin 을 붙여 다시 로그인해 주세요", { duration: 6000 });
    } else {
      toast("GitHub에 연결하지 못해 관리자 모드를 켜지 못했어요", { duration: 4000 });
    }
    return null;
  }

  const store = new AdminStore(repo);
  await store.load();
  const actions = createActions(store, onChange);

  document.body.classList.add("is-admin");
  mountBadge(() => { clearToken(); location.reload(); });
  bindMenus(actions, store);

  return {
    projects: store.projects,
    moreButton,
    newProjectButton: () => '<button type="button" class="a-new" data-admin="new-project">+ 새 프로젝트</button>',
  };
}
