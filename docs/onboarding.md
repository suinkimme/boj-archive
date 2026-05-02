# Onboarding Flow — 진행 현황 & 남은 작업

> 마지막 업데이트: 2026-04-30
>
> 다른 컴퓨터에서 이어서 작업할 때 이 문서부터 읽으세요.

## 1. 지금까지 한 것

### GitHub OAuth (커밋 완료, `ec95993ea`)
- `auth.ts` — Auth.js v5 (NextAuth beta) + GitHub Provider
- `app/api/auth/[...nextauth]/route.ts` — handlers
- `components/auth/SessionProvider.tsx` — 클라이언트 래퍼
- `components/auth/UserMenu.tsx` — 아바타 드롭다운 (`/me` 링크 포함)
- `TopNav` — 로그인 상태 분기
- 세션 전략: **JWT** (DB 없음)

### 온보딩 플로우 UI (이 브랜치 미커밋분)
모든 데이터는 mock + localStorage. 백엔드 붙으면 mock → 실제 API로 교체.

| 경로 | 역할 |
| --- | --- |
| `/onboarding` | 백준 아이디 입력 + solved.ac 미리보기 + 저장/스킵 |
| `/onboarding/verify` | 코드 챌린지 (복사 → solved.ac 자기소개 → 확인) |
| `/me` | 프로필 + 활동 요약 + 최근 푼 문제 + 계정 관리 |

#### 보조 파일
- `lib/mock/solvedac.ts` — mock 사용자 3명 (`shaolin1208`, `startlink`, `baekjoon`)
- `lib/onboarding/state.ts` — localStorage 기반 onboarding state hook
- `components/auth/TierBadge.tsx` — solved.ac 티어 SVG (CDN hotlink)
- `components/auth/OnboardingRedirect.tsx` — 첫 로그인 후 `/onboarding` 강제 이동 (클라이언트)
- `app/layout.tsx` — `OnboardingRedirect` 마운트

## 2. 결정된 디자인 / UX

### 용어
- BOJ 핸들 → **백준 아이디**
- 토큰 → **코드**
- 인증 → **본인 확인**
- 검증됨 → **확인됨**, 미검증 → **아직 확인 전**
- 헤딩에선 `백준 혹은 solved.ac` (별개 서비스라서)
- BOJ 서비스 종료 컨텍스트 가정 → 과거형 (`쓰시던`, `푸셨던`)

### 톤 (Toss 스타일)
- 헤딩은 질문형: "백준 혹은 solved.ac에서 쓰시던 아이디가 있으세요?"
- 버튼은 의지형: "이 아이디로 시작할게요", "다 했어요, 확인해주세요"
- 라벨 대신 컨텍스트로 풀어서 설명

### solved.ac 데이터 정책 — **B안 (실용적)**
- 표시: 푼 문제 + 티어 + 레이팅 + 클래스 + 티어 배지
- 사유: 다른 BOJ 도구들도 동일하게 표시, 비상업 + 출처 표기 시 사실상 묵인
- 의무: `/me` 푸터에 "푼 문제·티어 정보는 solved.ac에서 가져왔어요." (이미 추가)
- 본격 운영 전 권장: solved.ac 운영진 메일 1통

### 본인 확인 = bio 코드 챌린지
- solved.ac 자기소개에 임시 코드를 잠깐 박고 우리가 읽어 검증
- 코드 TTL: 30분
- 미확인 사용자도 가입은 허용 (랭킹 등 일부 기능만 차단)

## 3. 남은 작업

### 우선순위 1 — 백엔드 인프라
- [ ] Supabase Postgres 프로젝트 생성 → `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` 발급
- [ ] Drizzle ORM 설치 (`drizzle-orm`, `drizzle-kit`, `postgres`)
- [ ] `db/schema.ts` 작성:
  - `users` (id, githubId unique, login, name, email, image, bojHandle nullable unique, bojHandleVerifiedAt nullable, onboardedAt nullable, createdAt, updatedAt)
  - `accounts` (Auth.js 표준)
  - `bojVerifications` (id, userId, handle, token unique, expiresAt, consumedAt nullable)
  - `solvedAcSnapshots` (handle pk, tier, solvedCount, rating, raw jsonb, fetchedAt)
- [ ] `@auth/drizzle-adapter` 설치 + `auth.ts`에 연결 (세션은 JWT 유지)
- [ ] 마이그레이션 (`drizzle-kit push:pg` → 본격 운영 시 generate+migrate)
- [ ] Vercel Marketplace의 Supabase 통합으로 `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` 자동 주입 (Production + Preview)

### 우선순위 2 — solved.ac 연동
- [ ] `lib/solvedac/client.ts` — rate-limit-aware API 클라이언트
  - `fetchUser(handle)` → `/api/v3/user/show?handle=X`
  - `fetchSolvedProblems(handle, page)` → `/api/v3/search/problem?query=solved_by:X`
  - 최근 푼 문제 — solved.ac에 timestamp 노출 엔드포인트 있는지 확인 필요 (없으면 problemId 역순으로 대체)
- [ ] 서버 사이드 캐싱 — `unstable_cache` 또는 `solvedAcSnapshots` 테이블 (1시간 TTL 정도)
- [ ] `User-Agent` 헤더에 식별자: `NextJudge/0.1 (+https://...)`
- [ ] 에러 처리: 404 / 429 / 5xx

### 우선순위 3 — 온보딩 백엔드
- [ ] `POST /api/onboarding/handle` — bojHandle 저장 (인증 필요)
- [ ] `POST /api/onboarding/skip` — onboardedAt만 마킹
- [ ] `POST /api/verify/start` — 코드 발급 + `bojVerifications` insert
- [ ] `POST /api/verify/check` — solved.ac bio 조회 → 코드 매칭 → `bojHandleVerifiedAt` 업데이트
- [ ] 클라이언트 (`/onboarding`, `/onboarding/verify`)에서 mock fetch → 실제 API 교체
- [ ] `lib/mock/solvedac.ts`, `lib/onboarding/state.ts` 삭제

### 우선순위 4 — `OnboardingRedirect` 서버화
- [ ] `components/auth/OnboardingRedirect.tsx` 삭제
- [ ] `middleware.ts`에서 처리:
  - 인증 사용자가 `/`/`/me` 등 접근 → `users.onboardedAt` null이면 `/onboarding` redirect
- [ ] `/me`를 server component로 (`auth()` + DB 조회)
- [ ] localStorage 깜빡임 사라짐, skeleton 의존도 ↓

### 우선순위 5 — `/me` 디테일
- [ ] solved.ac 캐시 정책 + 수동 새로고침 버튼
- [ ] "최근 푼 문제" 데이터 소스 정리 (timestamp 부재 케이스 대응)
- [ ] 백준 아이디 연결 끊기 → DB의 `bojHandle` null + 캐시 정리
- [ ] 검증 만료 / 재검증 (사용자가 solved.ac에서 핸들 변경 시)

### 우선순위 6 — 운영 / 컴플라이언스
- [ ] solved.ac 운영진 메일 (사전 동의)
- [ ] 사용자 동의 문구 (회원가입 시 "내 solved.ac 데이터 캐싱·표시 동의")
- [ ] 탈퇴 / 데이터 삭제 플로우

### 보너스
- [ ] Vercel Preview용 OAuth App (현재 dev/prod만)
- [ ] solved.ac 티어 이미지 자체 호스팅 (CDN 의존 ↓)
- [ ] 첫 로그인 시 `github.login`을 백준 아이디로 자동 추측 → 미리보기 한 번에 떨어지면 사용자는 클릭 한 번만으로 끝

## 4. 다음에 시작할 때

```bash
# 이 브랜치 체크아웃
git fetch origin feat/github-login
git checkout feat/github-login

# 의존성 설치 (next-auth 추가됨)
npm install

# 환경변수 채우기 (.env.local)
#   AUTH_SECRET=<npx auth secret>
#   AUTH_GITHUB_ID=<dev OAuth App>
#   AUTH_GITHUB_SECRET=<dev OAuth App>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000

npm run dev
```

브라우저에서 http://localhost:3000 → 로그인 → 자동으로 `/onboarding` 진입 확인.
mock 핸들 (`shaolin1208`/`startlink`/`baekjoon`) 중 하나로 전체 플로우(저장 → `/me` → 본인 확인) 한 번 돌려보기.

그 다음 **우선순위 1 (DB 인프라)** 부터 진입.

## 5. 참고 / 컨텍스트

- 이 파일과 `CLAUDE.md` (PendingFeatureProvider 제거 체크리스트)
- 디자인 토큰: `tailwind.config.ts`
- AlertDialog 검정 default 버튼 패턴: `components/ui/AlertDialog.tsx`
- 티어 배지 SVG 출처: `https://static.solved.ac/tier_small/{0..31}.svg`
- mock 데이터 위치: `lib/mock/solvedac.ts`
