#!/usr/bin/env node
// Manta 앱 코드에서 '다음 화 전환' 시뮬레이터가 쓰는 값(거리 · 문구 · 색 · 글자 크기)을 읽어
// works/next-episode/state-simulator/spec.json 으로 저장한다.
//
//   node tools/sync-next-episode-spec.mjs            # 값 갱신. 동작 로직 파일이 바뀌었으면 '검토 필요'로 표시
//   node tools/sync-next-episode-spec.mjs --reviewed # 시뮬레이터 동작까지 맞춘 뒤 '검토 완료'로 표시
//
// 숫자 · 문구 · 색은 자동으로 따라간다. 상태별 분기 같은 동작 로직은 자동으로 옮길 수 없어서,
// 로직 파일 내용이 바뀌면 needsReview 에 남기고 페이지 상단에 경고를 띄운다.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.MANTA_APP_DIR || join(homedir(), 'dev/client/app');
const SRC = join(APP, 'src');
const OUT = join(ROOT, 'works/next-episode/state-simulator/spec.json');
const markReviewed = process.argv.includes('--reviewed');

const read = (rel) => readFileSync(join(SRC, rel), 'utf8');
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

const num = (rel, pattern, label) => {
  const m = read(rel).match(pattern);
  if (!m) fail(`${label}: ${rel} 에서 값을 못 찾았어요 (코드 구조가 바뀌었을 수 있어요)`);
  return Number(m[1]);
};

const P = {
  pullArea: 'components/blocks/ImageVerticalViewer/styles.ts',
  imageViewer: 'components/blocks/ImageVerticalViewer/index.tsx',
  guideStyles: 'components/blocks/PullNextGuide/styles.ts',
  guide: 'components/blocks/PullNextGuide/index.tsx',
  ring: 'components/blocks/PullNextGuide/PullProgressRing.tsx',
  footerAnim: 'components/pages/EpisodeViewer/ViewerFooter/useViewerFooterAnimation.ts',
  footerContainer: 'components/pages/EpisodeViewer/ViewerFooter/ViewerFooterContainer.tsx',
  reveal: 'components/pages/EpisodeViewer/ViewerFooter/NextEpisodeRevealGuide.tsx',
  gestureGuide: 'components/pages/EpisodeViewer/ViewerFooter/useGestureNextGuide.ts',
  gestureAction: 'components/pages/EpisodeViewer/ViewerFooter/EpisodeSection/getGestureNextAction.ts',
  episodeSection: 'components/pages/EpisodeViewer/ViewerFooter/EpisodeSection/index.tsx',
  episodeAction: 'components/pages/EpisodeViewer/ViewerFooter/EpisodeSection/useEpisodeAction.ts',
  rootOriginal: 'components/pages/EpisodeViewer/RootOriginal.tsx',
  episodeLock: 'components/pages/EpisodeViewer/useEpisodeLock.ts',
  webtoonControl: 'components/blocks/ControlOverlay/styles.ts',
  ebookControl: 'components/blocks/202308/ViewerController/BottomLine/styles.ts',
  tokens: 'styles/tokens.ts',
  en: 'i18n/en.json',
  es: 'i18n/es.json',
};

// ── 숫자 ────────────────────────────────────────────────
const ringSrc = read(P.ring);
const reachedRange = ringSrc.match(/REACHED_INPUT_RANGE = \[([^\]]+)\]/);
if (!reachedRange) fail('REACHED_INPUT_RANGE 를 못 찾았어요');

const constants = {
  pullAreaHeight: num(P.pullArea, /PULL_NEXT_AREA_HEIGHT = (\d+)/, 'PULL_NEXT_AREA_HEIGHT'),
  guideHeight: num(P.guideStyles, /GUIDE_HEIGHT = (\d+)/, 'GUIDE_HEIGHT'),
  releaseTolerance: num(P.imageViewer, /maxOffset - (\d+)/, '당김 끝 허용 오차'),
  guideFollowDivisor: num(P.imageViewer, /progressTranslateY=\{PULL_NEXT_AREA_HEIGHT \/ (\d+)\}/, '안내 따라오는 비율'),
  ringSize: num(P.guideStyles, /RING_SIZE = (\d+)/, 'RING_SIZE'),
  ringStroke: num(P.guideStyles, /RING_STROKE_WIDTH = (\d+)/, 'RING_STROKE_WIDTH'),
  ringReachedRange: reachedRange[1].split(',').map(Number),
  swipeDistance: num(P.footerAnim, /GO_NEXT_SWIPE_DISTANCE = (\d+)/, 'GO_NEXT_SWIPE_DISTANCE'),
  dismissRatio: num(P.footerAnim, /const threshold = frameSize \* ([\d.]+)/, '닫기 거리 비율'),
  dismissVelocity: num(P.footerAnim, /e\.velocityX > (\d+)/, '닫기 속도'),
  footerInMs: num(P.footerAnim, /translate\.value = withTiming\(0, \{ duration: (\d+) \}\);\n\s*\} else \{\n\s*translate\.value = initialValue/, 'footer 등장 시간'),
  webtoonControlHeight: num(P.webtoonControl, /WEBTOON_BOTTOM_CONTROL_HEIGHT = (\d+)/, 'WEBTOON_BOTTOM_CONTROL_HEIGHT'),
  ebookControlHeight: num(P.ebookControl, /EBOOK_VIEWER_CONTROL_HEIGHT = (\d+)/, 'EBOOK_VIEWER_CONTROL_HEIGHT'),
  freePassToastBottom: num(P.episodeLock, /fixedBottom: (\d+)/, 'Free Pass 토스트 위치'),
};

// 안내 표시 방식: 진행 링을 쓰는지(현재 시안 A), 화살표만 쓰는지
const guideSrc = read(P.guide);
const indicator = guideSrc.includes('<PullProgressRing') ? 'ring' : 'chevron';

// ── 토큰 ────────────────────────────────────────────────
const tokensSrc = read(P.tokens);
const block = (name) => {
  const m = tokensSrc.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\n\\}`));
  if (!m) fail(`${name} 를 못 찾았어요`);
  return m[1];
};
const text = {};
for (const [, k, size, line, weight] of block('textTokens').matchAll(/(\w+): \[(\d+), (\d+), (\d+)\]/g)) {
  text[k] = { size: +size, line: +line, weight: +weight };
}
const base = {};
for (const [, k, v] of block('colorBaseTokens').matchAll(/(\w+): '(#[0-9A-Fa-f]+)'/g)) base[k] = v;
const color = {};
for (const [, k, ref] of tokensSrc.matchAll(/^\s{2}(\w+): colorBaseTokens\.(\w+),/gm)) {
  if (base[ref] && !(k in color)) color[k] = base[ref];
}

// ── 문구 ────────────────────────────────────────────────
const en = JSON.parse(read(P.en));
const STRING_KEYS = [
  't_keep_scrolling_for_the_next_episode', 't_keep_scrolling_for_the_next_chapter',
  't_keep_scrolling_for_the_next_volume', 't_next_episode_coming_soon#2', 't_next_episode_coming_soon',
  't_next_chapter_coming_soon', 't_next_volume_coming_soon',
  't_next_episode', 't_next_chapter', 't_next_volume', 't_episode_$ord', 't_chapter_$ord', 't_volume_$ord',
  't_up_to_date', 't_you_ve_finished_it', 't_unlock_this_episode',
  't_unlock_next_episode', 't_unlock_next_chapter', 't_unlock_next_volume', 't_unlock_with_gems_to_continue', 't_free_pass_available',
  't_add_to_your_unlocked_library_with_gems', 't_list', 't_okay', 't_okay#2', 't_close', 't_notify_me',
  't_turn_on_notifications_to_stay_updated',
  't_you_re_all_set_we_ll_notify_you_when_the_next_episode_is_available',
  't_a_free_pass_has_been_used', 't_buy_episode', 't_fill_up_gems',
  't_this_series_is_protected_under_copyright_law#2', 't_my_gems', 't_single_episode', 't_single_chapter', 't_single_volume', 't_$count_gems#2_other',
  't_comments', 't_reply',
  't_you_ve_reached_the_final_episode', 't_you_ve_reached_the_final_chapter', 't_you_ve_reached_the_final_volume',
  't_you_ve_read_every_episode_of_$title_find_your_next_story_on_manta',
  't_you_ve_read_every_chapter_of_$title_find_your_next_story_on_manta',
  't_you_ve_read_every_volume_of_$title_find_your_next_story_on_manta',
];
const strings = {};
for (const k of STRING_KEYS) {
  if (!(k in en)) fail(`문구 ${k} 가 en.json 에 없어요`);
  strings[k] = en[k];
}
// 스페인어(Comic 만). es.json 에 없는 키는 앱처럼 영어로 보이므로 넣지 않는다(시뮬레이터가 영어로 폴백).
const es = JSON.parse(read(P.es));
const stringsEs = Object.fromEntries(STRING_KEYS.filter((k) => k in es).map((k) => [k, es[k]]));

// ── 동작 로직 지문 ───────────────────────────────────────
// 파일 전체가 큰 곳은 다음 화 전환과 관련된 부분만 잘라 본다(관계없는 수정으로 경고가 뜨지 않게).
const slice = (src, start, end) => {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = end ? src.indexOf(end, i + start.length) : -1;
  return src.slice(i, j < 0 ? undefined : j);
};
const imageViewerSrc = read(P.imageViewer);
const rootSrc = read(P.rootOriginal);
const logicSources = {
  'getGestureNextAction.ts': read(P.gestureAction),
  'useGestureNextGuide.ts': read(P.gestureGuide),
  'useEpisodeAction.ts': read(P.episodeAction),
  'EpisodeSection/index.tsx': read(P.episodeSection),
  'useViewerFooterAnimation.ts': read(P.footerAnim),
  'ViewerFooterContainer.tsx': read(P.footerContainer),
  'NextEpisodeRevealGuide.tsx': read(P.reveal),
  'PullNextGuide/index.tsx': guideSrc,
  'PullProgressRing.tsx': ringSrc,
  'ImageVerticalViewer/index.tsx (당김 영역)': slice(imageViewerSrc, "// 회차 끝 '당겨서 다음 화'", 'ListFooterComponent')
    + slice(imageViewerSrc, 'onMomentumScrollEnd', 'onScrollEndDrag={(e)')
    + slice(imageViewerSrc, 'onScrollEndDrag={(e)', '/>'),
  'RootOriginal.tsx (구매 시트 · 이동)': slice(rootSrc, 'const goAnotherEpisodeViewer', 'const loadAnotherEpisode'),
};
// 화면 모양을 옮겨 그린 컴포넌트. 바뀌면 시뮬레이터 화면도 다시 맞춰야 한다.
const VISUAL_FILES = [
  'components/pages/EpisodeViewer/ViewerFooter/index.tsx',
  'components/pages/EpisodeViewer/ViewerFooter/styles.ts',
  'components/pages/EpisodeViewer/ViewerFooter/EpisodeSection/styles.ts',
  'components/pages/EpisodeViewer/Footer/EpisodeCommentPreview/index.tsx',
  'components/blocks/bm/PurchaseEpisodeModal/Ui202509/index.tsx',
  'components/blocks/bm/PurchaseEpisodeModal/Ui202509/styles.ts',
  'components/blocks/bm/PurchaseEpisodeModal/Ui202509/OptionItem/index.tsx',
  'components/blocks/bm/PurchaseEpisodeModal/Ui202509/TopBox/index.tsx',
  'components/blocks/BottomSlideMenu/index.tsx',
  'components/blocks/popups/DefaultDialog2.tsx',
  'components/blocks/popups/styles.ts',
  'components/blocks/popups/DefaultConfirmDialog2/index.tsx',
  'hocs/GlobalModalAnimationContainer/index.tsx',
  'hocs/GlobalModalAnimationContainer/styles.ts',
  'components/blocks/ControlOverlay/WebtoonTopControlBox.tsx',
  'components/blocks/ControlOverlay/WebtoonBottomControlBox/index.tsx',
  'components/blocks/ControlOverlay/styles.ts',
  'components/blocks/202308/ViewerController/TopLine/index.tsx',
  'components/blocks/202308/ViewerController/BottomLine/index.tsx',
  'components/blocks/202308/ViewerController/BottomLine/styles.ts',
  'components/atoms/Toast.tsx',
  'components/atoms/styles.ts',
  'hocs/withToast.tsx',
];
for (const f of VISUAL_FILES) {
  if (existsSync(join(SRC, f))) logicSources[`화면: ${f}`] = read(f);
  else console.warn(`  (참고) ${f} 가 없어요. 경로가 바뀌었으면 VISUAL_FILES 를 고쳐 주세요.`);
}
const sourceHashes = {};
for (const [k, v] of Object.entries(logicSources)) {
  if (!v) fail(`${k} 에서 다음 화 전환 코드를 못 찾았어요`);
  sourceHashes[k] = createHash('sha1').update(v).digest('hex').slice(0, 12);
}

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
let needsReview = prev?.needsReview || [];
if (markReviewed) {
  needsReview = [];
} else if (prev?.sourceHashes) {
  const changed = Object.keys(sourceHashes).filter((k) => prev.sourceHashes[k] !== sourceHashes[k]);
  needsReview = [...new Set([...needsReview, ...changed])];
}

// ── 코드 버전 ────────────────────────────────────────────
const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { cwd: APP, encoding: 'utf8' }).trim(); } catch { return ''; }
};
const dirty = git('status --porcelain -- src').split('\n').filter(Boolean).length;

const spec = {
  source: {
    branch: git('rev-parse --abbrev-ref HEAD'),
    commit: git('rev-parse --short HEAD'),
    uncommittedFiles: dirty,
    syncedAt: new Date().toISOString(),
  },
  constants: { ...constants, indicator },
  strings,
  stringsEs,
  text,
  color,
  sourceHashes,
  needsReview,
};

writeFileSync(OUT, `${JSON.stringify(spec, null, 2)}\n`);

const changedValues = prev
  ? Object.keys(spec.constants).filter((k) => JSON.stringify(prev.constants?.[k]) !== JSON.stringify(spec.constants[k]))
  : [];
console.log(`✔ spec.json 갱신 (${spec.source.branch}@${spec.source.commit}, 커밋 전 파일 ${dirty}개)`);
if (changedValues.length) console.log(`  바뀐 값: ${changedValues.map((k) => `${k} ${JSON.stringify(prev.constants[k])} → ${JSON.stringify(spec.constants[k])}`).join(', ')}`);
if (needsReview.length) {
  console.log(`⚠ 동작 로직이 바뀐 파일이 있어요. 시뮬레이터(index.html) 동작을 맞춘 뒤 --reviewed 로 다시 실행하세요:`);
  needsReview.forEach((k) => console.log(`  - ${k}`));
  process.exitCode = 2;
}
