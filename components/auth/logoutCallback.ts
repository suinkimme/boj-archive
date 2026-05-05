// signOut 후 머무를 경로를 결정한다. 공개 페이지면 현재 경로를 유지하고,
// 인증이 필요한 경로(/me, /onboarding/*)에 있었다면 홈으로 폴백한다.
const AUTH_REQUIRED_PREFIXES = ['/me', '/onboarding']

export function getLogoutCallbackUrl(): string {
  if (typeof window === 'undefined') return '/'
  const pathname = window.location.pathname
  const requiresAuth = AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return requiresAuth ? '/' : pathname
}
