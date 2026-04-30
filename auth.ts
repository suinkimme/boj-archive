import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.login = (profile as { login?: string }).login
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && typeof token.login === 'string') {
        session.user.login = token.login
      }
      return session
    },
  },
})
