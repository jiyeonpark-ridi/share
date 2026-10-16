// 관리자 코드는 필요할 때만 불러온다.
// 토큰이 저장돼 있거나 주소에 ?admin 이 있을 때만 admin/index.js를 가져오고,
// 그 외(팀원 방문)에는 아무것도 불러오지 않는다.

import { TOKEN_KEY } from "./admin/config.js";

function wantsAdmin() {
  if (new URLSearchParams(location.search).has("admin")) return true;
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export async function maybeStartAdmin(options) {
  if (!wantsAdmin()) return null;
  const { startAdmin } = await import("./admin/index.js");
  return startAdmin(options);
}
