// /problems/[id] 전용 로딩 경계.
// 이 파일이 없으면 async Page()가 서버 fetch 하는 동안 상위 app/loading.tsx
// (문제 목록 스켈레톤)가 노출되고 스크롤이 0으로 리셋되는 문제가 생긴다.
// 디테일 페이지와 같은 bg로 빈 화면을 유지해 전환 시 화면 깜박임을 최소화한다.

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-card" />
  )
}
