import { Role } from "@/generated/prisma/enums";
import { getCurrentUser, SessionData } from "./auth";
import { NextResponse } from "next/server";

// Role hierarchy for determining dashboard redirect
export function getDashboardPath(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "/super-admin";
    case Role.ADMIN_MANAGER:
      return "/admin";
    case Role.SALES_MANAGER:
      return "/sales";
    case Role.ADMIN:
      return "/admin";
    case Role.SALES:
      return "/sales";
  }
}

// API route guard — call at the top of API route handlers
export async function requireRole(
  ...allowedRoles: Role[]
): Promise<
  | { user: SessionData; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
