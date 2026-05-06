# UI 컴포넌트 API

디자인 시스템 컴포넌트 레퍼런스. 새 컴포넌트 도입 금지 — 기존 토큰을 조합해서 만들 것.

---

## AlertDialog

`components/ui/AlertDialog.tsx`

React Native `Alert.alert` 버튼 스타일 모델. 다이얼로그 변형(variant)이 아니라
버튼 배열로 동작을 정의한다.

```tsx
<AlertDialog
  open={open}
  onClose={() => setOpen(false)}
  title="정말 삭제하시겠습니까?"
  description="이 작업은 되돌릴 수 없습니다."
  buttons={[
    { label: '취소', style: 'cancel' },
    { label: '삭제', style: 'destructive', onPress: handleDelete },
  ]}
/>
```

**Button styles**

| style | 외형 |
|-------|------|
| `default` | filled black — 확인/긍정 액션 |
| `cancel` | outlined neutral — 취소 |
| `destructive` | filled brand-red — 삭제/비가역 액션 |

`buttons` 생략 시 `{ label: '확인', style: 'default' }` 단일 버튼으로 렌더.

---

## Tooltip

`components/ui/Tooltip.tsx`

hover 시 텍스트 툴팁을 위쪽에 표시. CSS `group` 패턴 사용.

```tsx
<Tooltip content="GitHub에서 보기">
  <button>...</button>
</Tooltip>
```

| Prop | Type | 설명 |
|------|------|------|
| `content` | `string` | 툴팁 텍스트 |
| `children` | `ReactNode` | 툴팁을 붙일 대상 |
| `className` | `string?` | 래퍼 `span`에 추가할 클래스 |

---

## Badge

`components/ui/Badge.tsx`

인라인 레이블 배지. 주로 헤더/히어로 영역에서 사용.

```tsx
<Badge variant="dark">NEXT JUDGE<span className="text-brand-red">.</span></Badge>
<Badge variant="red">NEW</Badge>
```

| variant | 외형 |
|---------|------|
| `dark` (기본) | `bg-brand-dark text-white` |
| `red` | `bg-brand-red text-white` |

---

## MarkdownRenderer

`components/notices/MarkdownRenderer.tsx`

공지사항 및 문제 본문 렌더러. 디자인 토큰을 `components` prop으로 매핑.

```tsx
// 공지사항 페이지
<MarkdownRenderer markdown={markdownString} />

// 문제 상세처럼 외부에서 컴포넌트만 재사용
import { markdownComponents } from '@/components/notices/MarkdownRenderer'
<ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
  {text}
</ReactMarkdown>
```

지원 요소: h1~h3, p, a, strong, em, ul/ol/li, blockquote, code, pre(CodeMirror), hr, details/summary, table, img

---

## FilterDropdown

`components/challenges/FilterDropdown.tsx`

문제 목록 필터 드롭다운. 멀티셀렉트 기본, `single` prop으로 싱글셀렉트.

```tsx
<FilterDropdown
  defaultLabel="모든 유형"
  icon={TagIcon}
  items={[{ value: '수학', label: '수학', count: 12 }]}
  selected={tags}
  onToggle={handleTagToggle}
  widthAnchor="모든 유형"   // 드롭다운 최소 너비 기준 텍스트
  emptyMessage="등록된 유형이 없어요"
/>

// 싱글셀렉트 (정렬 등)
<FilterDropdown
  single
  items={ORDER_ITEMS}
  selected={[order]}
  onToggle={handleOrderChange}
/>
```
