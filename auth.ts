import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

import { db } from './db'
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from './db/schema'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [GitHub],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile, user, trigger }) {
      if (profile) {
        token.login = (profile as { login?: string }).login
      }
      if (user?.id) {
        token.userId = user.id
      }
      // onboardedAt 은 한번 set 되면 안 바뀌므로 캐싱해도 되지만, bojHandle 은
      // 온보딩에서 변경 가능하니 update 트리거 시 함께 갱신한다. 둘 다 한 쿼리로.
      const userId = typeof token.userId === 'string' ? token.userId : null
      if (
        userId &&
        (!token.onboardedAt ||
          token.bojHandle === undefined ||
          trigger === 'update')
      ) {
        const [row] = await db
          .select({
            onboardedAt: users.onboardedAt,
            bojHandle: users.bojHandle,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        if (row?.onboardedAt) {
          token.onboardedAt = row.onboardedAt.toISOString()
        }
        token.bojHandle = row?.bojHandle ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.login === 'string') {
          session.user.login = token.login
        }
        if (typeof token.userId === 'string') {
          session.user.id = token.userId
        }
        if (typeof token.onboardedAt === 'string') {
          session.user.onboardedAt = token.onboardedAt
        }
        if (token.bojHandle !== undefined) {
          // JWT augmentation 이 callback param 추론에 항상 반영되진 않아 명시 캐스팅.
          session.user.bojHandle = token.bojHandle as string | null
        }
      }
      return session
    },
  },
})
