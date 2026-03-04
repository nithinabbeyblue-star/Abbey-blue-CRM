import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: Role;
  isLoggedIn: boolean;
}

/**
 * Get the current authenticated user. Returns null if not logged in,
 * suspended, or session version mismatch (kill-switched).
 *
 * Drop-in replacement for the old iron-session version —
 * same interface, same imports. All 20+ consuming files need zero changes.
 */
export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Kill-switch check: verify user is still ACTIVE with matching sessionVersion
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, sessionVersion: true },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !== session.user.sessionVersion
  ) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email!,
    name: session.user.name!,
    role: session.user.role as Role,
    isLoggedIn: true,
  };
}
