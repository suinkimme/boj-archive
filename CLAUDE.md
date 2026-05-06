# Project Notes for Claude

## 프로젝트 개요

**NEXT JUDGE** — 커뮤니티가 함께 만드는 오픈 알고리즘 저지.
모든 문제는 GitHub PR을 통해 기여되고, 채점은 브라우저에서 WebAssembly로 실행된다.

- **프레임워크**: Next.js 15 App Router, TypeScript
- **DB**: Supabase (PostgreSQL) + Drizzle ORM
- **인증**: NextAuth v5 (GitHub OAuth)
- **채점**: 브라우저 내 WebAssembly (서버에 코드 미전송)
- **공지사항**: Notion API → `scripts/fetch-notices.ts` → 빌드 시 마크다운 저장

---

## Challenges 시스템

### 폴더 구조

```
challenges/<slug>/
  problem.md        # frontmatter(메타) + 마크다운 본문
  solution.py       # CI 검증용 레퍼런스 풀이
  testcases/        # 히든 테스트케이스 (선택)
    01.in / 01.out
  gen.py            # 랜덤 입력 생성기 (선택)
  brute.py          # 브루트포스 풀이 (선택)
```

### problem.md 포맷

```markdown
---
title: "문제 제목"
time_limit: "1s"
memory_limit: "256MB"
tags:
  - 수학
  - 구현
samples:
  - input: "1 2"
    output: "3"
---

문제 본문 (마크다운, $수식$ 지원)

## 입력

입력 형식 설명

## 출력

출력 형식 설명
```

본문 전체가 `challenges.description`으로 저장된다. 섹션 파싱 없음.

### 태그

허용 태그 목록: `components/challenges/tags.ts`에서 관리.
한글 문자열 그대로 저장/표시 (영문 변환 테이블 없음).
PR에서 목록에 없는 태그 사용 시 CI 실패.

새 태그 추가: `tags.ts`에 항목 추가하는 별도 PR 필요.

### CI 워크플로우

| 파일 | 트리거 | 동작 |
|------|--------|------|
| `.github/workflows/validate.yml` | PR to main/develop (challenges/** 변경) | 스키마 검증 + 솔루션 실행 |
| `.github/workflows/sync.yml` | push to main (challenges/** 변경) | DB upsert |
| `.github/workflows/record-contributors.yml` | PR closed+merged to main | PR 작성자를 challenge_contributors에 기록 |

### 스크립트

```bash
npm run challenges:validate   # 로컬 검증 (특정 slug: npm run challenges:validate sum-two-numbers)
npm run challenges:sync       # challenges/ → DB 동기화 (POSTGRES_URL_NON_POOLING 필요)
npx tsx scripts/record-contributor.ts <slug> <github_login>  # 기여자 수동 등록
```

---

## DB 스키마

### 핵심 테이블

```
challenges               문제 카탈로그
  id, slug (unique), title, description,
  inputFormat, outputFormat, samples (jsonb),
  tags (text[]), timeLimit, memoryLimit

challengeTestcases       히든 테스트케이스
  challengeId → challenges.id
  caseIndex, stdin, expectedStdout

challengeSubmissions     제출 기록
  userId → users.id
  challengeId → challenges.id
  language, verdict (AC/WA/RE/TLE), submittedAt

challengeContributors    문제 기여자
  challengeId → challenges.id
  githubLogin (unique per challenge)
```

### 레거시 테이블 (BOJ 시절 잔재, 현재 미사용)

`problems`, `testcases`, `submissions`, `userSolvedProblems`, `standardProblems`
→ 현재 기능에서 참조하지 않지만 스키마에 남아 있음. 향후 정리 예정.

### 마이그레이션

```bash
npm run db:generate   # 스키마 변경 후 migration 파일 생성
npm run db:migrate    # migration 적용
npm run db:studio     # Drizzle Studio UI
```

---

## 라우트 구조

```
/                           문제 목록 (서버 컴포넌트, DB 실데이터)
/challenges/[slug]          문제 상세 + 에디터 + 채점 (split-panel)
/notices                    공지사항 목록
/notices/[slug]             공지사항 상세
/me                         내 정보 (최근 푼 문제, 통계)
/me/challenges              내 풀이 기록 전체
```

### API 라우트

```
GET  /api/challenges/[slug]/judge/inputs     히든 케이스 stdin (AES-GCM 암호화)
POST /api/challenges/[slug]/judge/verify     actual outputs → verdicts 반환
GET  /api/challenges/[slug]/submissions      제출 기록 (keyset 페이지네이션)
POST /api/challenges/[slug]/submissions      제출 저장
GET  /api/me                                 내 정보 + 최근 푼 문제
GET  /api/me/challenges                      내 전체 풀이 기록
```

---

## 채점 아키텍처

코드 실행은 전부 브라우저에서 일어난다. 서버는 hidden testcase 정답 비교만 담당.

```
사용자 코드 제출
  → useJudge 훅
  → Web Worker (Pyodide / wasm-clang)
  → 샘플 케이스: 브라우저에서 직접 비교
  → 히든 케이스:
      1. /api/challenges/[slug]/judge/inputs 로 암호화된 stdin fetch
      2. 브라우저에서 복호화 + 실행
      3. actual outputs → /api/challenges/[slug]/judge/verify POST
      4. 서버가 DB의 expectedStdout과 비교 → verdicts 반환
```

자세한 내용: `lib/judge/README.md`

언어별 런타임: `lib/judge/runtimes/` — 새 언어 추가 절차도 README에 있음.

---

## 컴포넌트 구조

### `components/challenges/`
문제 목록 페이지용 컴포넌트.
- `ChallengesView` — 검색/필터/정렬/목록 통합 client 컴포넌트
- `ProblemItem` / `ProblemList` — 문제 카드 (slug 기반 링크)
- `TopNav` — 사이트 상단 네비게이션
- `FilterDropdown` — 재사용 가능한 멀티셀렉트 드롭다운
- `tags.ts` — 허용 태그 목록

### `components/problems/`
문제 상세 페이지용 컴포넌트 (challenges와 구 BOJ 문제 공용).
- `CodeEditor` — 언어 선택 + CodeMirror + 제출 툴바
- `TestcasePanel` — 입력/결과 탭
- `SubmissionHistory` — 제출 기록 (keyset 페이지네이션, optimistic UI)

`CodeEditor` 주요 props:
```tsx
<CodeEditor
  draftId="challenge:sum-two-numbers"   // localStorage 키 (string | number)
  submissionsUrl="/api/challenges/slug/submissions"
  verifyUrl="/api/challenges/slug/judge/verify"
  langs={['python']}                    // 허용 언어 (생략 시 전체)
  samples={[...]}
  hiddenInputs={[...]}
  onJudgeResult={...}
/>
```

### `components/notices/`
- `MarkdownRenderer` — 공지사항 + 문제 본문 공용 마크다운 렌더러
  `markdownComponents` export로 외부에서 재사용 가능

---

## Temporary "준비 중" Alert System

`components/ui/PendingFeatureProvider.tsx`는 아직 구현되지 않은 기능에
"준비 중" AlertDialog를 띄우는 임시 scaffold. `app/layout.tsx`에 마운트.

### 현재 wired up

| Location | Trigger | Label |
|----------|---------|-------|
| `components/challenges/TopNav.tsx` | 커뮤니티 메뉴 | `커뮤니티` |
| `components/challenges/TopNav.tsx` | 랭킹 메뉴 | `랭킹` |

### 제거 체크리스트

1. 각 `usePendingFeature('...')` 호출을 실제 핸들러로 교체
2. 호출처가 모두 사라지면:
   - `components/ui/PendingFeatureProvider.tsx` 삭제
   - `app/layout.tsx`에서 `<PendingFeatureProvider>` 래퍼 제거
3. `components/ui/AlertDialog.tsx`는 유지 (디자인 시스템 컴포넌트)

---

## 주요 환경변수

```
POSTGRES_URL                  Supabase pooled URL (앱 런타임)
POSTGRES_URL_NON_POOLING      직접 연결 (scripts/sync-challenges.ts 등)
AUTH_SECRET                   NextAuth 시크릿
AUTH_GITHUB_ID / SECRET       GitHub OAuth
NEXT_PUBLIC_JUDGE_INPUT_KEY   hidden inputs AES-256-GCM 키 (64자 hex)
NOTION_TOKEN                  공지사항 fetch
```
