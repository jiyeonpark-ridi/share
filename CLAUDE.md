# Handoff Lab 작업 규칙

이 레포는 "Jiyeon's Handoff Lab" 정적 사이트(GitHub Pages)다. 구조와 데이터 형식은 README.md를 따른다.

## "올려줘" 요청을 받으면

1. 어느 프로젝트에 넣을지 판단한다. 애매하거나 새 프로젝트가 필요할 때만 물어본다.
2. 작업물 id를 영문 소문자 · 하이픈으로 정하고 `works/<프로젝트 id>/<작업물 id>/`에 파일을 넣는다.
3. `data/projects.json`에 작업물을 추가한다. title · type · summary는 작업물 내용을 읽고 초안을 쓴다. date는 오늘.
4. 상태 변경 · 링크 칩(PRD, Figma 등) 추가를 말하면 같은 프로젝트 항목에 반영한다.
5. 로컬 서버로 홈 · 상세 화면을 열어 확인한 뒤, 바뀐 점을 보여주고 commit · push 전에 확인받는다 (공개 사이트).
6. 공유용 주소(`project.html?p=…&w=…`)를 알려준다.

## 지킬 것

- 화면 HTML에 목록을 직접 쓰지 않는다. 목록은 항상 `data/projects.json`에서 온다.
- 색 · 간격은 `assets/css/base.css`의 토큰(`--c-*`, `--r-*`)만 쓴다. 포인트 색은 `--c-accent`(#1D4ED8) 하나.
- 데이터를 템플릿 문자열에 넣을 때는 `esc()`를 거친다.
- 작업물 원본(`works/` 안)은 사이트 스타일과 독립적이다. 사이트 CSS를 작업물에 섞지 않는다.
- 이미 공유한 주소는 지우지 말고, 옮길 때는 리다이렉트를 남긴다 (예: `pull-trigger/`).
- 사내 미공개 정보가 보이면 올리기 전에 알린다.

## 앱 코드와 연동된 작업물

`works/next-episode/state-simulator/`는 Manta 앱 코드(~/dev/client/app, 다음 화 전환 기능)를 기준으로 동작한다.
앱의 다음 화 전환 코드를 고친 뒤에는 이 작업물도 같이 맞춘다.

1. `node tools/sync-next-episode-spec.mjs` 실행 → 거리 · 문구 · 색 · 글자 크기가 `spec.json`에 자동 반영된다.
2. 종료 코드 2(⚠ 동작 로직이 바뀐 파일 목록)가 나오면, 그 파일의 바뀐 분기를 `index.html`의 Sim 클래스 · GROUPS에 옮긴다.
   반영 전까지 페이지 상단에 "아직 반영 전" 경고가 뜬다.
3. 로컬 서버로 바뀐 상태를 직접 조작해 확인한 뒤 `--reviewed`로 다시 실행해 경고를 지운다.
4. `data/projects.json`의 작업물 date를 오늘로 바꾸고, commit · push 전에 확인받는다.
