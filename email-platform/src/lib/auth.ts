import type { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";
import { env } from "./env";
import { z } from "zod";
import { logger } from "./logger";

// Augment session with organization + role information the UI needs.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      organizationId: string;
      organizationSlug: string;
      role: "OWNER" | "ADMIN" | "MANAGER" | "ANALYST";
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  secret: env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { memberships: { include: { organization: true } } },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        const membership = user.memberships[0];
        if (!membership) {
          logger.warn({ userId: user.id }, "login: user has no membership");
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          organizationId: membership.organizationId,
          organizationSlug: membership.organization.slug,
          role: membership.role,
        } as never;
      },
    }),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          organizationId: string;
          organizationSlug: string;
          role: string;
        };
        token.userId = u.id;
        token.organizationId = u.organizationId;
        token.organizationSlug = u.organizationSlug;
        token.role = u.role;
      }
      // Ensure Google-logged-in users get a membership lookup
      if (!token.organizationId && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          include: { memberships: { include: { organization: true } } },
        });
        const m = dbUser?.memberships[0];
        if (dbUser && m) {
          token.userId = dbUser.id;
          token.organizationId = m.organizationId;
          token.organizationSlug = m.organization.slug;
          token.role = m.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.organizationId) {
        session.user.id = token.userId as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationSlug = token.organizationSlug as string;
        session.user.role = token.role as "OWNER" | "ADMIN" | "MANAGER" | "ANALYST";
      }
      return session;
    },
  },
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// RBAC helpers
export const ROLE_RANK: Record<string, number> = {
  ANALYST: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function hasRole(userRole: string | undefined, minRole: string): boolean {
  if (!userRole) return false;
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
}
