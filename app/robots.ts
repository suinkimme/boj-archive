import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 개인/계정 화면과 API 라우트는 색인 대상이 아니다.
        disallow: ['/api/', '/me', '/me/', '/onboarding', '/onboarding/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
