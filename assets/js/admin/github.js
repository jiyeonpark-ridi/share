// GitHub REST API로 레포를 읽고, 여러 파일 변경을 커밋 하나로 묶어 올린다.
// 필요한 토큰 권한: 이 레포의 Contents → Read and write

import { REPO } from "./config.js";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const decoder = new TextDecoder();
const decodeBase64Utf8 = (b64) =>
  decoder.decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

export class GitHubRepo {
  constructor(token) {
    this.token = token;
    this.base = `${API}/repos/${REPO.owner}/${REPO.repo}`;
  }

  async request(path, { method = "GET", body } = {}) {
    const res = await fetch(this.base + path, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let message = res.statusText;
      try { message = (await res.json()).message || message; } catch { /* 본문 없음 */ }
      throw new GitHubError(res.status, message);
    }
    return res.status === 204 ? null : res.json();
  }

  /** 토큰이 이 레포에 쓰기 권한이 있는지 확인 */
  async checkAccess() {
    const repo = await this.request("");
    if (!repo.permissions?.push) throw new GitHubError(403, "이 레포에 쓰기 권한이 없는 토큰이에요");
    return repo;
  }

  /** 지금 브랜치 끝 커밋과 전체 파일 목록 */
  async snapshot() {
    const ref = await this.request(`/git/ref/heads/${REPO.branch}`);
    const head = ref.object.sha;
    const commit = await this.request(`/git/commits/${head}`);
    const tree = await this.request(`/git/trees/${commit.tree.sha}?recursive=1`);
    return { head, treeSha: commit.tree.sha, entries: tree.tree };
  }

  async readText(snapshot, path) {
    const entry = snapshot.entries.find((e) => e.path === path && e.type === "blob");
    if (!entry) throw new GitHubError(404, `${path} 파일이 없어요`);
    const blob = await this.request(`/git/blobs/${entry.sha}`);
    return decodeBase64Utf8(blob.content);
  }

  /** entries(바꿀 파일 목록)를 커밋 하나로 올린다. 그사이 브랜치가 움직였으면 422 */
  async commit(snapshot, entries, message) {
    const tree = await this.request("/git/trees", { method: "POST", body: { base_tree: snapshot.treeSha, tree: entries } });
    const commit = await this.request("/git/commits", { method: "POST", body: { message, tree: tree.sha, parents: [snapshot.head] } });
    await this.request(`/git/refs/heads/${REPO.branch}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
    return commit.sha;
  }
}

/* ---------- 커밋에 넣을 파일 변경 만들기 ---------- */

export const writeFile = (path, content) => ({ path, mode: "100644", type: "blob", content });

const blobsUnder = (snapshot, dir) => {
  const prefix = `${dir.replace(/\/$/, "")}/`;
  return snapshot.entries.filter((e) => e.type === "blob" && e.path.startsWith(prefix)).map((e) => ({ ...e, rest: e.path.slice(prefix.length) }));
};

export const deleteDir = (snapshot, dir) =>
  blobsUnder(snapshot, dir).map((e) => ({ path: e.path, mode: e.mode, type: "blob", sha: null }));

export const moveDir = (snapshot, from, to) =>
  blobsUnder(snapshot, from).flatMap((e) => [
    { path: `${to.replace(/\/$/, "")}/${e.rest}`, mode: e.mode, type: "blob", sha: e.sha },
    { path: e.path, mode: e.mode, type: "blob", sha: null },
  ]);
