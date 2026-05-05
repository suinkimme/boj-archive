// 사이트 절대 URL — 메타데이터 / sitemap / robots 등에서 공통으로 쓰인다.
// env에 trailing slash가 박혀 있어도 `${SITE_URL}/path`가 `//path`가 되지
// 않도록 정규화한다.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.next-judge.com'
).replace(/\/+$/, '')

export const SITE_NAME = 'NEXT JUDGE.'

export const SITE_DESCRIPTION =
  '직접 풀고, 직접 채점하는 모두에게 열린 알고리즘 저지'
