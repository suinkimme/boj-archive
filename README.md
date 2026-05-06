# NEXT JUDGE

acmicpc.net 서비스 종료에 따라 공익 목적으로 수집한 알고리즘 문제 아카이브입니다.

---

## 프론트엔드 (Next.js)

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

## 라이선스

### 서비스 코드

비상업적 이용에 한해 자유롭게 사용·수정·배포할 수 있습니다.
상업적 이용(유료 서비스 운영, 수익 창출 목적의 사용 등)은 저작권자(Suin Kim)의 **사전 서면 동의**가 필요합니다.
자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.

> 이 프로젝트는 향후 독자적인 기능을 포함한 상용 서비스로 발전할 예정입니다.

### 문제 데이터

아카이브된 문제(제목·본문·조건·예제 등)의 저작권은 각 문제의 원 출제자 및 해당 대회 주최 기관에 귀속됩니다.
본 프로젝트는 acmicpc.net 서비스 종료에 따른 **비상업적 공익 아카이브** 목적으로만 해당 데이터를 수집·제공하며, 문제 콘텐츠에 대한 소유권을 주장하지 않습니다.
