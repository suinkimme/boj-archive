# Vercel + Neon 배포 가이드

> Production DB와 dev DB는 서로 다른 Neon 브랜치여야 합니다.
> 마이그레이션이 잘못된 환경에 적용되지 않도록 환경별 `DATABASE_URL`을 분리하세요.

## 1. Neon — 브랜치 분리

Neon은 git처럼 DB 브랜치를 만들 수 있습니다. 권장 구조:

| 브랜치 | 용도 | 누가 쓰나 |
| --- | --- | --- |
| `main` (=production) | 진짜 사용자 데이터 | Vercel production deploy만 |
| `dev` | 로컬 개발 | 본인 로컬 (`.env.local`) |
| `preview/*` | PR별 격리 | Vercel + Neon Integration이 자동 생성 |

### 처음 셋업

1. Neon 콘솔 → 현재 프로젝트 → **Branches** 탭
2. `main`이 production 브랜치 (이미 존재)
3. **Create branch** → 이름 `dev` → `main`에서 분기
4. `dev` 브랜치의 connection string을 본인 `.env.local`의 `DATABASE_URL`로 교체
5. `main` connection string은 **로컬에 절대 두지 않음** — Vercel에만 등록

> 이미 `main` 브랜치를 dev로 쓰고 있었다면, `dev` 브랜치를 분기한 직후 그 connection string으로 `.env.local`을 갈아끼우면 됩니다. main에 있던 dev 데이터는 그대로 옮겨감 (분기 시 스냅샷).

## 2. Vercel — 프로젝트 + 환경변수

### a. 프로젝트 생성

1. Vercel 대시보드 → **Add New** → **Project** → GitHub repo 연결
2. Framework Preset: Next.js (자동)
3. **Build Command**: 그대로 (`npm run build`) — 이미 `drizzle-kit migrate && next build`로 정의됨
4. 일단 배포 안 누르고 환경변수부터 등록

### b. Neon Integration (권장)

`Vercel Marketplace → Neon` 추가하면:
- Production env에 `main` 브랜치 connection string 자동 주입
- Preview env에 PR별 자동 분기 브랜치 주입 (PR 닫으면 자동 삭제)
- 환경변수 이름: `DATABASE_URL` (또는 `POSTGRES_URL` — 우리는 `DATABASE_URL` 기준이니 매핑 확인)

수동으로 하려면 Vercel → Project Settings → Environment Variables에서:

| 변수 | Production | Preview | Development |
| --- | --- | --- | --- |
| `DATABASE_URL` | `main` 브랜치 URL | (선택) `dev` 또는 별도 preview 브랜치 | (비워둠 — 로컬은 `.env.local`) |

### c. 그 외 환경변수

| 변수 | Production | Preview | 설명 |
| --- | --- | --- | --- |
| `AUTH_SECRET` | `npx auth secret`로 생성 (prod 전용) | 같거나 다른 값 | NextAuth |
| `AUTH_GITHUB_ID` | prod OAuth App | preview OAuth App (선택) | GitHub OAuth |
| `AUTH_GITHUB_SECRET` | 위와 짝 | 위와 짝 | |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | `https://*-yourname.vercel.app` (Vercel 자동) | OG 이미지 등 |
| `SOLVEDAC_DEV_MOCK` | **비워둠/삭제** | **비워둠/삭제** | dev에서만 mock |

> **`SOLVEDAC_DEV_MOCK`을 production에 set하지 마세요.** set되면 진짜 solved.ac 호출이 항상 mock 데이터로 덮어씁니다.

### d. GitHub OAuth callback URL

GitHub OAuth App 설정에 production callback 추가:
```
https://your-domain.com/api/auth/callback/github
```

Preview용 별도 OAuth App을 만들거나, 같은 App에 여러 callback URL 등록.

## 3. 첫 배포

1. main 브랜치 push → Vercel이 자동 빌드
2. Build 단계에서 `drizzle-kit migrate` 실행 → `main` Neon 브랜치에 schema apply
3. `next build` → 정적/서버 빌드
4. Deploy → 도메인 활성화

마이그레이션은 **idempotent** — 이미 적용된 SQL은 skip (`__drizzle_migrations` 메타 테이블로 추적).

## 4. 마이그레이션 흐름 (개발자 사이클)

```bash
# 1. schema.ts 수정
# 2. SQL 파일 생성 (db/migrations/NNNN_*.sql)
npm run db:generate

# 3. 로컬 dev DB에 적용
npm run db:migrate

# 4. PR push → Vercel preview 빌드가 preview DB에 자동 적용
# 5. main merge → Vercel production 빌드가 main DB에 자동 적용
```

## 5. 안전 장치

- **`.env.local`은 절대 commit하지 않음** (이미 `.gitignore`)
- **production `DATABASE_URL`은 로컬에 두지 않음** — Vercel ENV에서만
- 마이그레이션 SQL은 review 후 commit — destructive change(컬럼/테이블 drop)는 다단계 배포 권장
- production DB는 백업 활성화 (Neon Pro 이상에서 PITR 자동)

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
| --- | --- |
| Vercel build 실패 — `DATABASE_URL is not set` | Vercel 환경변수에 `DATABASE_URL` 미등록. Neon Integration 다시 확인 |
| `relation "users" already exists` | 마이그레이션이 동일 SQL 두 번 실행 시도. `__drizzle_migrations` 테이블 확인, 수동 정리 필요할 수 있음 |
| Production에서 solved.ac 403 | 사용자 IP 평판 이슈 — 실제 사용자 브라우저는 통과. dev에서만 mock 우회 사용 |
