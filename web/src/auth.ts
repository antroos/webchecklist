import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";

import { ensureUserExists } from "@/lib/userStore";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account }) {
      // We use Google providerAccountId as our stable user id.
      const userId = account?.providerAccountId;
      if (userId) {
        await ensureUserExists({
          userId,
          email: user.email,
          name: user.name,
        });
      }
      return true;
    },
    async session({ session, token }) {
      // Expose stable user id to the app (token.sub == provider account id).
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}


