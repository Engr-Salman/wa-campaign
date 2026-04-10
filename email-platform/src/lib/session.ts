import { getServerSession } from "next-auth";
import { authOptions, hasRole } from "./auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  organizationId: string;
  organizationSlug: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "ANALYST";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  min: "OWNER" | "ADMIN" | "MANAGER" | "ANALYST",
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user.role, min)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
