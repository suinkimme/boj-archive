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
        const login = (profile as { login?: string }).login
        token.login = login
        if (user?.id && login) {
          await db.update(users).set({ login }).where(eq(users.id, user.id))
        }
      }
      if (user?.id) {
        token.userId = user.id
      }
      const userId = typeof token.userId === 'string' ? token.userId : null
      if (userId && (!token.onboardedAt || trigger === 'update')) {
        const [row] = await db
          .select({ onboardedAt: users.onboardedAt })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        if (row?.onboardedAt) {
          token.onboardedAt = row.onboardedAt.toISOString()
        }
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
      }
      return session
    },
  },
})
