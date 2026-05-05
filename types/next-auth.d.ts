import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      login?: string
      bojHandle?: string | null
      onboardedAt?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    login?: string
    userId?: string
    bojHandle?: string | null
    onboardedAt?: string
  }
}
