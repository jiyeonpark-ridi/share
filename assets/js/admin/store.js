// 관리자 데이터 저장소.
// 저장할 때마다 최신 projects.json을 다시 읽어 변경을 적용하므로,
// 그사이 handoff 스킬이 작업물을 추가해도 덮어쓰지 않는다.

import { GitHubError, writeFile } from "./github.js";
import { DATA_PATH } from "./config.js";
import { normalizeProjects, dataUrl } from "../data.js";
import { toast } from "../toast.js";

const MAX_TRIES = 3;
const PUBLISH_POLL_MS = 5000;
const PUBLISH_TIMEOUT_MS = 4 * 60 * 1000;

export class AdminStore {
  constructor(repo) {
    this.repo = repo;
    this.raw = { projects: [] };
    this.publishWatch = 0;
  }

  get projects() {
    return normalizeProjects(this.raw);
  }

  async load() {
    const snapshot = await this.repo.snapshot();
    this.raw = JSON.parse(await this.repo.readText(snapshot, DATA_PATH));
    return this.projects;
  }

  /**
   * @param {object} change
   * @param {string} change.message 커밋 메시지
   * @param {(raw:object) => object|void} change.mutate raw를 직접 고친다. 돌려준 값은 files와 결과로 전달
   * @param {(snapshot, ctx) => object[]} [change.files] 함께 바꿀 파일(폴더 삭제 · 이동)
   */
  async save({ message, mutate, files }) {
    for (let attempt = 1; ; attempt++) {
      const snapshot = await this.repo.snapshot();
      const raw = JSON.parse(await this.repo.readText(snapshot, DATA_PATH));
      const ctx = mutate(raw) ?? {};
      const text = `${JSON.stringify(raw, null, 2)}\n`;
      const entries = [writeFile(DATA_PATH, text), ...(files ? files(snapshot, ctx) : [])];
      try {
        await this.repo.commit(snapshot, entries, `관리자: ${message}`);
        this.raw = raw;
        this.watchPublish(text);
        return ctx;
      } catch (err) {
        // 422 = 그사이 다른 커밋이 들어옴 → 최신본으로 다시 시도
        if (err instanceof GitHubError && err.status === 422 && attempt < MAX_TRIES) continue;
        throw err;
      }
    }
  }

  /** 사이트에 실제로 반영될 때까지 공개된 projects.json을 확인한다 */
  async watchPublish(expected) {
    const id = ++this.publishWatch;
    toast("저장했어요 · 사이트에 반영 중 (약 1분)", { duration: 4000 });
    const started = Date.now();
    while (Date.now() - started < PUBLISH_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, PUBLISH_POLL_MS));
      if (id !== this.publishWatch) return; // 더 최근 저장이 확인을 이어받음
      try {
        const res = await fetch(`${dataUrl()}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok && (await res.text()) === expected) {
          toast("사이트에 반영됐어요", { duration: 3000 });
          return;
        }
      } catch { /* 네트워크 오류는 다음 확인에서 다시 */ }
    }
  }
}
