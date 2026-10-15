# Jiyeon's Handoff Lab

AI와 바이브코딩으로 직접 개발한 디자인 시안 · 인터랙션 프로토타입을 모아 두고, 링크 하나로 건네는 사이트예요.
GitHub Pages로 배포되고, 빌드 과정이 없어요.

## 구조

```
index.html              홈: 소개 + 상태 필터 + 프로젝트 리스트
project.html            상세: 프로젝트 | 작업물 | 작업물 영역(iframe)
data/projects.json      ★ 프로젝트 · 작업물 목록 (여기만 고치면 화면에 반영)
works/<프로젝트>/<작업물>/index.html   작업물 원본 (그대로 iframe으로 띄움)
assets/css/             base(공통 토큰 · 헤더 · 칩) / home / project
assets/js/              data(JSON 읽기) · header(⌘K 검색) · home · project · toast · dom
pull-trigger/           예전 공유 주소를 새 주소로 넘겨주는 리다이렉트
tools/                  앱 코드에서 값을 뽑아 오는 동기화 스크립트 (예: sync-next-episode-spec.mjs)
```

## 주소

- 홈: `/` (상태 필터는 `/?status=active` 처럼 주소에 남음)
- 프로젝트: `/project.html?p=next-episode`
- 작업물: `/project.html?p=next-episode&w=pull-trigger` ← 공유용 링크
- 작업물만 크게: `/works/next-episode/pull-trigger/`

## 데이터 형식 (`data/projects.json`)

```jsonc
{
  "projects": [
    {
      "id": "next-episode",            // 주소와 폴더 이름에 쓰임 (영문 소문자 · 하이픈)
      "name": "다음화 전환경험 개선",
      "status": "active",              // active(진행중) | planned(진행예정) | done(완료)
      "summary": "한 줄 설명",           // 검색에 쓰임
      "start": "2026-09-22",           // 선택. 작업물이 없을 때 "시작일"로 보여줌
      "links": [                       // 선택. 작업물 칸의 링크 칩. url이 비어 있으면 숨김
        { "label": "PRD", "url": "https://…" },
        { "label": "Figma", "url": "https://…" }
      ],
      "works": [
        {
          "id": "pull-trigger",        // works/<프로젝트 id>/<작업물 id>/ 폴더와 같아야 함
          "title": "다음 화 당김 표시 시안",
          "type": "프로토타입",          // 자유 텍스트 (프로토타입 · 영상 · 디자인 …)
          "date": "2026-10-14",        // 업데이트 날짜. 최신순 정렬 기준
          "summary": "검색용 한 줄 설명",
          "url": "https://…"           // 선택. 외부 주소를 띄울 때만 (기본은 works/ 폴더)
        }
      ]
    }
  ]
}
```

프로젝트의 "최근 업데이트"는 작업물 날짜 중 가장 최근 값으로 자동 계산돼요.

## 새 작업물 올리기

1. `works/<프로젝트 id>/<작업물 id>/index.html`에 작업물을 넣는다 (이미지 등은 같은 폴더에).
2. `data/projects.json`의 해당 프로젝트 `works`에 항목을 추가한다.
3. 새 프로젝트면 `projects`에 항목을 추가한다.

## 로컬에서 보기

ES 모듈과 `fetch`를 써서 파일을 바로 열면 동작하지 않아요. 간단한 서버로 열어 주세요.

```sh
python3 -m http.server 8000
# http://localhost:8000
```
