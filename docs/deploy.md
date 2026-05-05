# Vercel + Supabase 배포 가이드

> DB는 Vercel Marketplace의 Supabase 통합으로 프로비저닝하고, 함수
> 리전을 DB와 같은 서울(`icn1`)에 고정합니다.

## 1. Supabase 프로젝트

Vercel Marketplace → **Supabase** 설치:

- Primary Region: **Seoul (`ap-northeast-2`)**
- Plan: **Free** (오픈 전), 운영 직전 **Pro ($25/mo)** 로 전환
- Connect to Project: `boj-archive` 선택, 환경(Development / Preview / Production) 모두 체크
- Custom Prefix: 비움 (표준 키 이름 유지)
- Sensitive: 체크

설치가 끝나면 Vercel 환경변수에 다음이 자동 주입됩니다:

| 변수 | 용도 |
| --- | --- |
| `POSTGRES_URL` | **pooled** (PgBouncer transaction mode, 6543) — 런타임용 |
| `POSTGRES_URL_NON_POOLING` | **direct** (5432) — 마이그레이션 / bulk import 용 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_DATABASE` | 분해된 값 |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_ANON_KEY` 등 | Supabase 클라이언트용 (현재 미사용) |

코드 매핑:
- `db/index.ts` → `POSTGRES_URL` (pooled, `prepare: false`)
- `drizzle.config.ts` → `POSTGRES_URL_NON_POOLING` (direct, 마이그레이션)
- `scripts/import-*.ts` → `POSTGRES_URL_NON_POOLING` (direct, batched insert)

## 2. Vercel 함수 리전

`vercel.json`:
```json
{ "regions": ["icn1"] }
```

DB와 함수가 같은 서울 리전이라 함수↔DB 라운드트립이 한 자릿수 ms.

## 3. 그 외 환경변수

| 변수 | Production | Preview | Development | 설명 |
| --- | --- | --- | --- | --- |
| `AUTH_SECRET` | `npx auth secret` (prod 전용) | 같거나 다른 값 | `.env.local` | NextAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | prod OAuth App | preview OAuth App (선택) | dev OAuth App | GitHub OAuth |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | Vercel 자동 | `http://localhost:3000` | OG 등 |
| `SOLVEDAC_DEV_MOCK` | **삭제** | **삭제** | (선택) | dev mock |

> **`SOLVEDAC_DEV_MOCK`을 production에 두지 마세요.** 실제 호출이 mock 데이터로 덮어씁니다.

## 4. GitHub OAuth callback URL

GitHub OAuth App 설정에 production callback 추가:
```
https://your-domain.com/api/auth/callback/github
```
Preview용 별도 OAuth App을 만들거나, 같은 App에 callback URL 여럿 등록.

## 5. 첫 배포

1. Supabase 프로젝트가 비어 있는 상태에서 로컬에서 한 번 마이그레이션:
   ```bash
   vercel env pull .env.local         # POSTGRES_URL_NON_POOLING 등 받아옴
   npm run db:migrate                  # drizzle-kit migrate (direct URL 사용)
   npm run db:upload-problem-images    # 문제 이미지 → Cloudflare R2 (선행)
   npm run db:import-problems          # problems/<id>/problem.json → DB
   npm run db:import-testcases         # testcases.json → DB (선택)
   ```
   `db:upload-problem-images` 는 `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` 이 필요하다.
   Cloudflare R2 무료 티어(10GB 저장 + egress 무료)로 운영. 업로드 결과는
   `scripts/problem-image-urls.json` 에 저장되며, 다음 단계의
   `db:import-problems` 가 이 매핑을 읽어 본문 HTML 의 `<img src="1.png">` 같은
   상대 경로를 R2 의 public URL 로 치환해 DB 에 저장한다.
2. main 브랜치 push → Vercel 자동 빌드
3. Build 단계에서 `drizzle-kit migrate` 실행 (idempotent — 이미 적용된 SQL은 skip)
4. 배포 완료

## 6. 마이그레이션 흐름

```bash
# 1. db/schema.ts 수정
# 2. SQL 파일 생성
npm run db:generate

# 3. 로컬에서 적용 (POSTGRES_URL_NON_POOLING 사용)
npm run db:migrate

# 4. main merge → Vercel 빌드 단계에서 production DB에 자동 적용
```

> Free 플랜은 PR마다 DB 브랜치를 자동 분기하지 않습니다. 모든 환경이 동일 DB를 공유하므로, **destructive change** (컬럼/테이블 drop)는 다단계 배포로 진행하세요.

## 7. 안전 장치

- `.env.local`은 commit 금지 (이미 `.gitignore`)
- 운영 직전 **Supabase Pro 전환** — 일일 백업 + 일시정지 해제
- Free 플랜은 7일간 활동 없으면 프로젝트 자동 일시정지 (요청 시 깨어남, 첫 응답 수십 초 지연)
- destructive 마이그레이션은 review 후 commit, 가능하면 read-only 단계 거치기

## 8. 트러블슈팅

| 증상 | 원인 / 해결 |
| --- | --- |
| Vercel build 실패 — `POSTGRES_URL_NON_POOLING is not set` | Supabase 통합 환경변수 미주입. Vercel → Settings → Integrations → Supabase 재연결 |
| `prepared statement "..." already exists` | pooled URL을 사용하면서 `prepare: false`를 빠뜨림. `db/index.ts` 확인 |
| `relation "users" already exists` | 마이그레이션 중복 실행. `__drizzle_migrations` 테이블 확인 |
| Production에서 solved.ac 403 | 사용자 IP 평판 이슈 — 실제 사용자 브라우저는 통과. dev에서만 mock 우회 사용 |
