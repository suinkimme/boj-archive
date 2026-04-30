import { DrizzleAdapter } from '@auth/drizzle-adapter'
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
    async jwt({ token, profile, user }) {
      if (profile) {
        token.login = (profile as { login?: string }).login
      }
      if (user?.id) {
        token.userId = user.id
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
      }
      return session
    },
  },
})
