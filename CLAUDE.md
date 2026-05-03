# Project Notes for Claude

## Temporary "준비 중" Alert System

`components/ui/PendingFeatureProvider.tsx` is a **temporary scaffold** that
surfaces a "준비 중" `AlertDialog` whenever a user interacts with a
feature that hasn't been built out yet. It is NOT part of the long-term
design system and should be removed once everything it covers ships.

### Currently wired up

| Location | Trigger | Feature label shown |
| --- | --- | --- |
| `components/challenges/ProblemItem.tsx` | row click | `에디터` |
| `app/me/page.tsx` | 최근 푼 문제 row click | `에디터` |
| `components/challenges/TopNav.tsx` | each non-routed menu item | `프로젝트 소개` / `커뮤니티` / `기여하기` / `랭킹` (공지사항은 실 라우트) |
| `components/challenges/TopNav.tsx` | login button | `로그인` |

The provider itself is mounted in `app/layout.tsx` so any descendant
client component can call `usePendingFeature(label?)`.

### Removal checklist

When real routes / handlers land:

1. Replace each `usePendingFeature('...')` call with the actual
   navigation or handler.
2. Once **no** caller of `usePendingFeature()` is left, delete:
   - `components/ui/PendingFeatureProvider.tsx`
   - the `<PendingFeatureProvider>` wrapper and its import in
     `app/layout.tsx`
3. Keep `components/ui/AlertDialog.tsx` — it's a real design-system
   component used elsewhere.

## AlertDialog API

`components/ui/AlertDialog.tsx` follows the React Native
`Alert.alert` button-style model rather than per-dialog variants.

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

Button styles:

- `default` — filled black confirm button
- `cancel` — outlined neutral button
- `destructive` — filled brand-red button (delete / irreversible)

When `buttons` is omitted, a single `{ label: '확인', style: 'default' }`
button is rendered.
