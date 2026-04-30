# DESIGN.md

이 문서는 서비스 전반의 디자인 시스템을 정의합니다.  
**Claude Code와 팀 개발자 모두 이 문서를 기준으로 UI를 구현합니다.**

> 디자인 레퍼런스: Krafton "Ways of Working · Typing Game" 이벤트 페이지  
> 플랫폼: Next.js / React (외부 유저 대상 웹 서비스)

---

## 원칙

1. **컴포넌트를 새로 디자인하지 않는다.** 이 문서에 정의된 토큰과 컴포넌트를 조합한다.
2. **레드는 포인트 컬러다.** 배경 대면적 사용 금지. CTA, 강조 텍스트, 테두리 포인트에만 쓴다.
3. **여백은 넉넉하게.** 섹션 패딩은 `px-14 py-10` (56px/40px) 기준.
4. **영문 레이블은 항상 대문자 + 자간 확장.** `uppercase tracking-widest text-[10px]`
5. **그림자 금지.** 입체감은 `border-b-4`(키캡)이나 테두리 색 변화로 표현한다.

---

## 1. 색상 토큰

`tailwind.config.ts`의 `extend.colors`에 등록하고 사용한다.

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          red:    '#F9423A',  // 주요 강조색 — CTA, 포인트, 섹션 경계
          dark:   '#1C1F28',  // 기본 텍스트, 다크 카드 배경
          white:  '#FFFFFF',
        },
        text: {
          primary:   '#1C1F28',
          secondary: '#4A484C',
          muted:     '#9B989A',
        },
        surface: {
          page:       '#F5F5F5',  // 전체 페이지 배경
          card:       '#FFFFFF',
          notice:     '#FFF4F3',  // 공지/노트 연한 레드 배경
          noticeDark: '#FFE9E7',
        },
        border: {
          DEFAULT: '#E4E3E5',  // 카드·섹션 구분선
          key:     '#CFCDCF',  // 키캡·서브 테두리
          list:    '#F0F0F1',  // 리스트 아이템 구분선
        },
        highlight: '#EB6B56',  // 인라인 날짜·키워드 강조 배지
        status: {
          success: { DEFAULT: '#1E8E3E', bg: '#E6F4EA' }, // 난이도 1~2 (쉬움)
          warning: { DEFAULT: '#B06000', bg: '#FEF7E0' }, // 난이도 3 (보통)
          danger:  { DEFAULT: '#B3261E', bg: '#FCE8E6' }, // 난이도 4~5 (어려움)
        },
      },
    },
  },
}
```

### 색상 사용 규칙

| 상황 | 사용 색상 |
|------|-----------|
| 주요 버튼, 강조 텍스트, 레드 테두리 | `brand-red` |
| 헤드라인, 다크 배지, 다크 카드 | `brand-dark` |
| 본문 설명 | `text-secondary` |
| 날짜·메타·영문 레이블 | `text-muted` |
| 섹션 배경 | `surface-page` |
| 카드·공지 배경 | `surface-card`, `surface-notice` |
| 레벨/상태 라벨 (쉬움·보통·어려움) | `text-status-success`, `text-status-warning`, `text-status-danger` + `bg-status-{...}-bg` |
| 리스트 행 hover | `bg-surface-page` |
| 빈 체크박스/빈 원 보더 | `border-border-key` |

---

## 2. 타이포그래피

폰트 스택:

```ts
// tailwind.config.ts
fontFamily: {
  sans: ["'Noto Sans KR'", "'본고딕'", "'Malgun Gothic'", "sans-serif"],
}
```

### 스케일

| 용도 | Tailwind 클래스 | 비고 |
|------|----------------|------|
| 히어로 H1 | `text-[40px] font-extrabold leading-tight tracking-tight` | |
| 섹션 H2 | `text-[22px] font-bold tracking-tight` | SectionHeader 컴포넌트에서 사용 |
| 강조 카드 제목 | `text-lg font-extrabold` | |
| 본문 Large | `text-[15px] leading-relaxed` | |
| 본문 Default | `text-sm leading-relaxed` | |
| 영문 서브레이블 | `text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted` | 항상 대문자 |
| 배지/태그 | `text-[11px] font-bold uppercase tracking-[0.12em]` | |
| 주석·캡션 | `text-xs leading-relaxed text-text-secondary` | |

---

## 3. 컴포넌트

모든 컴포넌트는 `components/ui/` 하위에 위치한다.

### 3-1. SectionHeader

모든 섹션 타이틀에 사용. 레드 세로 바 + 한글 제목 + 영문 서브레이블 3요소 세트.

```tsx
// components/ui/SectionHeader.tsx
interface SectionHeaderProps {
  title: string
  label: string  // 영문 대문자 서브레이블
}

export function SectionHeader({ title, label }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <div className="w-1 h-5 bg-brand-red flex-shrink-0" />
      <h2 className="text-[22px] font-bold tracking-tight text-text-primary m-0">
        {title}
      </h2>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
    </div>
  )
}
```

사용 예시:
```tsx
<SectionHeader title="게임 플레이 안내" label="HOW TO PLAY" />
<SectionHeader title="상품 안내" label="REWARDS" />
```

---

### 3-2. Badge

```tsx
// components/ui/Badge.tsx
type BadgeVariant = 'dark' | 'red'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'dark' }: BadgeProps) {
  const base = "inline-block px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
  const variants = {
    dark: "bg-brand-dark text-white",
    red:  "bg-brand-red text-white",
  }
  return (
    <div className={`${base} ${variants[variant]}`}>
      {children}
    </div>
  )
}
```

---

### 3-3. NoticeBlock

좌측 3px 레드 보더 + 연한 레드 배경.

```tsx
// components/ui/NoticeBlock.tsx
export function NoticeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-notice border-l-[3px] border-brand-red px-5 py-4 text-sm text-text-secondary leading-relaxed">
      {children}
    </div>
  )
}
```

---

### 3-4. KeyCap

타이핑·키보드 모티프 UI에 사용.

```tsx
// components/ui/KeyCap.tsx
type KeyCapVariant = 'default' | 'active' | 'wide'

interface KeyCapProps {
  label: string
  variant?: KeyCapVariant
}

export function KeyCap({ label, variant = 'default' }: KeyCapProps) {
  const base = "flex items-center justify-center font-black rounded-[4px] border border-b-4 select-none"
  const variants = {
    default: "w-16 h-16 text-[22px] bg-surface-card text-text-primary border-border-key",
    active:  "w-16 h-16 text-[22px] bg-brand-red text-white border-brand-red",
    wide:    "flex-1 h-16 bg-surface-card text-text-muted border-border-key text-[10px] tracking-[0.15em] font-semibold pl-4 justify-start",
  }
  return (
    <div className={`${base} ${variants[variant]}`}>
      {label}
    </div>
  )
}
```

핵심: `border-b-4` 로 입체감 표현. `box-shadow` 사용 금지.

---

### 3-5. CTAButton

레드 CTA + 우측 메타 정보 조합.

```tsx
// components/ui/CTAButton.tsx
interface CTAButtonProps {
  href: string
  label: string
  meta?: { heading: string; value: string }
}

export function CTAButton({ href, label, meta }: CTAButtonProps) {
  return (
    <div className="flex w-full">
      <a
        href={href}
        className="flex-1 bg-brand-red text-white px-6 py-[18px] text-base font-bold tracking-tight hover:opacity-90 transition-opacity"
      >
        {label}
      </a>
      {meta && (
        <div className="px-6 py-[18px] border border-border-key flex flex-col justify-center whitespace-nowrap">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted mb-0.5">
            {meta.heading}
          </div>
          <div className="font-bold text-text-primary text-sm">{meta.value}</div>
        </div>
      )}
    </div>
  )
}
```

---

### 3-6. Card

```tsx
// components/ui/Card.tsx
type CardVariant = 'default' | 'highlighted' | 'dark'

interface CardProps {
  children: React.ReactNode
  variant?: CardVariant
  className?: string
}

export function Card({ children, variant = 'default', className = '' }: CardProps) {
  const variants = {
    default:     "border border-border bg-surface-card",
    highlighted: "border border-brand-red bg-surface-card",
    dark:        "border border-border bg-brand-dark text-white",
  }
  return (
    <div className={`p-5 relative ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}
```

---

### 3-7. InlineHighlight

날짜, 마감일 등 인라인 키워드 강조.

```tsx
// components/ui/InlineHighlight.tsx
export function InlineHighlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-highlight text-white px-1 py-px text-sm font-medium">
      {children}
    </span>
  )
}
```

---

### 3-8. FAQItem

```tsx
// components/ui/FAQItem.tsx
interface FAQItemProps {
  question: string
  answer: React.ReactNode
  isLast?: boolean
}

export function FAQItem({ question, answer, isLast = false }: FAQItemProps) {
  return (
    <details className={`py-3.5 ${!isLast ? 'border-b border-border-list' : ''}`}>
      <summary className="cursor-pointer flex items-baseline gap-2.5 text-[15px] font-semibold text-text-primary list-none">
        <span className="text-brand-red font-extrabold">Q</span>
        <span>{question}</span>
      </summary>
      <div className="flex gap-2.5 mt-2.5 text-sm text-text-secondary leading-relaxed">
        <span className="text-text-muted font-extrabold">A</span>
        <div>{answer}</div>
      </div>
    </details>
  )
}
```

---

### 3-9. ListItem

규칙 목록, 안내 항목 등 key-value 형태 리스트에 사용.

```tsx
// components/ui/ListItem.tsx
interface ListItemProps {
  label: string
  children: React.ReactNode
  isLast?: boolean
}

export function ListItem({ label, children, isLast = false }: ListItemProps) {
  return (
    <li className={`flex gap-3.5 py-3 items-start ${!isLast ? 'border-b border-border-list' : ''}`}>
      <div className="text-sm leading-relaxed">
        <strong className="font-bold mr-2.5">{label}</strong>
        <span className="text-text-secondary">{children}</span>
      </div>
    </li>
  )
}
```

---

## 4. 레이아웃

### 페이지 컨테이너

```tsx
<div className="max-w-[800px] mx-auto bg-surface-page font-sans text-text-primary">
  {/* 섹션들 */}
</div>
```

### 섹션 래퍼

```tsx
<section className="bg-surface-card px-14 py-10 border-t border-border">
  <SectionHeader title="..." label="..." />
  {/* 콘텐츠 */}
</section>
```

### 카드 그리드 (2열)

```tsx
<div className="grid grid-cols-2 gap-3">
  <Card>...</Card>
  <Card>...</Card>
  <Card className="col-span-2">...</Card>  {/* 전체 너비 카드 */}
</div>
```

---

## 5. 페이지 구성 패턴

새 페이지는 아래 섹션 블록을 조합해 구성한다.

```
[Hero Section]  — bg-white, px-14 pt-12 pb-6
  ├── 메타 정보 (날짜·카테고리) — 우측 정렬, text-muted uppercase
  ├── 빨간 소제목 — 영문 대문자, text-brand-red
  ├── H1 헤드라인 — 핵심 키워드에 text-brand-red 적용
  ├── Badge
  └── (선택) KeyCap 시각화

[공지 섹션]  — bg-white, px-14 py-10
  ├── Badge variant="red"  (공지 배지)
  ├── NoticeBlock          (공지 본문)
  └── CTAButton            (주요 액션 1개)

[일반 섹션]  — bg-white, px-14 py-10, border-t border-border
  ├── SectionHeader
  └── ListItem 목록 또는 Card 그리드 또는 FAQItem 목록
```

---

## 6. Do / Don't

### ✅ 해야 할 것

- `brand-red`는 한 화면에서 포인트 1–2곳에만 사용
- 섹션 구분은 반드시 `border-t border-border`
- 영문 서브레이블은 항상 `uppercase tracking-[0.18em]` 이상
- 카드 입체감은 `border-b-4`로만 표현
- CTA는 페이지당 1개 원칙 — 여러 액션이 있을 경우 우선순위를 정해 하나만 레드로

### ❌ 하지 말 것

- `box-shadow` 사용 금지
- `brand-red`를 넓은 배경에 사용 금지 (다크 카드 안 인라인 버튼 제외)
- 섹션 헤더에서 레드 세로 바 생략 금지
- `Inter`, `Roboto` 등 범용 폰트 사용 금지
- 색상 하드코딩 금지 — 반드시 토큰 사용. 새 색상이 필요하면 이 문서에 먼저 등록

---

## 7. Claude Code 지침

### 의사결정 트리

정의되지 않은 UI가 필요할 때 **반드시 아래 순서**를 따른다.

```
새 UI 요소 필요
      │
      ▼
[STEP 1] components/ui/ 에 적합한 컴포넌트가 있는가?
      │
      ├─ YES → 재사용. 끝.
      │
      └─ NO
            │
            ▼
      [STEP 2] 기존 컴포넌트 2개 이상을 조합하면 해결되는가?
            │
            ├─ YES → 조합으로 구현. 새 컴포넌트 파일 생성 금지.
            │
            └─ NO
                  │
                  ▼
            [STEP 3] 아래 확장 패턴에 따라 신규 컴포넌트 생성.
                     이 문서 섹션 3에 정의를 추가한 뒤 구현.
```

---

### STEP 2 — 조합 예시

기존 컴포넌트를 감싸거나 나열해 새 레이아웃을 만든다. 새 파일을 만들지 않는다.

```tsx
// 예: 공지 + CTA 묶음 → NoticeBlock과 CTAButton 조합
<div className="flex flex-col gap-5">
  <NoticeBlock>마감일은 4월 30일입니다.</NoticeBlock>
  <CTAButton href="/play" label="지금 시작하기 →" />
</div>

// 예: 카드 안에 리스트 → Card + ListItem 조합
<Card>
  <ul>
    <ListItem label="기간">2026.04.22 ~ 04.30</ListItem>
    <ListItem label="대상" isLast>전 직원</ListItem>
  </ul>
</Card>

// 예: 다크 카드 안 배지 → Card variant="dark" + Badge
<Card variant="dark">
  <Badge variant="red">특별 추첨</Badge>
  <p className="text-white mt-3">당첨자 3명에게 20만원 상당 경품</p>
</Card>
```

---

### STEP 3 — 확장 패턴 (신규 컴포넌트 생성 규칙)

조합으로 해결 불가능할 때만 신규 컴포넌트를 만든다.  
아래 템플릿을 반드시 따른다.

```tsx
// components/ui/[ComponentName].tsx

// ✅ 필수: 색상은 반드시 토큰 클래스만 사용
// ✅ 필수: box-shadow 금지
// ✅ 필수: 새 색상값 하드코딩 금지 — 필요 시 tailwind.config.ts 토큰에 먼저 등록
// ✅ 필수: 영문 레이블은 uppercase + tracking-[0.12em] 이상
// ✅ 필수: 입체감 표현은 border-b-4 사용

interface [ComponentName]Props {
  // props 정의
}

export function [ComponentName]({ ... }: [ComponentName]Props) {
  return (
    <div className="/* 토큰 클래스만 사용 */">
      {/* 내부에서도 기존 컴포넌트 재사용 우선 */}
    </div>
  )
}
```

신규 컴포넌트를 만든 뒤에는 **이 문서 섹션 3에 아래 형식으로 정의를 추가**한다.

```markdown
### 3-N. [ComponentName]

[언제 쓰는지 한 줄 설명]

\`\`\`tsx
// 코드 스니펫
\`\`\`
```

---

### 기타 규칙

- 색상 하드코딩 금지 — `brand-red`, `text-secondary` 등 토큰만 사용
- 새 페이지 레이아웃은 섹션 5 패턴을 기본으로 조합
- 위 3단계로도 판단이 어려우면 구현을 멈추고 사용자에게 확인 요청
