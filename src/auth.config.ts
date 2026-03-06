import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth config (no Prisma / Node.js imports).
 * Used by middleware for JWT verification + RBAC.
 * The full config in src/auth.ts extends this with the Credentials provider.
 */
export const authConfig = {
  providers: [], // Added in src/auth.ts (Credentials needs DB)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.mustSetPassword = user.mustSetPassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as string;
      session.user.sessionVersion = token.sessionVersion as number;
      session.user.mustSetPassword = token.mustSetPassword as boolean;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // 24 hours
  },
  trustHost: true,
} satisfies NextAuthConfig;
