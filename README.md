# BOJ Archive

백준 온라인 저지(acmicpc.net) 서비스 종료에 따라 공익 목적으로 수집한 문제 아카이브입니다.

이 저장소는 두 개의 트랙을 동시에 운영합니다.

| 트랙 | 위치 | 상태 |
|------|------|------|
| **현행 정식 서비스** (정적 사이트) | [`legacy/`](./legacy) | 운영 중 — GitHub Pages 배포 |
| **v1.0 신규 프론트엔드** (Next.js + TS) | 저장소 루트 | 개발 중 |

신규 트랙이 v1.0으로 릴리즈될 때까지 `legacy/`가 단독 배포 대상입니다.

---

## 신규 프론트엔드 (Next.js)

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm run type-check
```

### 폴더 구조

```
app/                  # Next.js App Router
components/ui/        # DESIGN.md §3 UI 컴포넌트
public/               # 정적 자산
tailwind.config.ts    # DESIGN.md 색상·타이포 토큰
DESIGN.md             # 디자인 시스템 단일 소스 — UI 작업 전 반드시 참조
```

UI를 새로 만들 때는 [`DESIGN.md`](./DESIGN.md) §7의 의사결정 트리를 따릅니다 — 기존 컴포넌트 재사용 → 조합 → 신규 생성 순.

---

## 현행 서비스 (legacy/)

운영 중인 정적 사이트입니다. 이 폴더만으로 자체 완결된 빌드/테스트가 가능합니다.

```bash
cd legacy
npm install
npm run test:unit
npm run test:e2e
npx serve .          # 로컬 미리보기
```

자세한 내용은 [`legacy/README.md`](./legacy/README.md)를 참조하세요.

### 배포

`main` 브랜치의 `legacy/` 변경 시 [`.github/workflows/deploy-legacy.yml`](./.github/workflows/deploy-legacy.yml)이 GitHub Pages로 자동 배포합니다.

> **One-time setup:** 저장소 Settings → Pages → **Source: GitHub Actions** 로 변경되어 있어야 합니다. (기존 "Deploy from a branch" 모드를 사용 중이었다면 한 번 전환이 필요합니다.)

---

## 라이선스

[MIT](./LICENSE) — 각 문제의 저작권은 원 출제자 및 해당 대회 주최 기관에 귀속됩니다.
