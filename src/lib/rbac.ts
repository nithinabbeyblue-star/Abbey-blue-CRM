import { Role } from "@/generated/prisma/enums";
import { getCurrentUser, SessionData } from "./auth";
import { NextResponse } from "next/server";

// Route-to-role mapping for middleware
// More specific paths must come first so they match before generic ones
const routeRoleEntries: [string, Role[]][] = [
  ["/api/users/admins", [Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN]],
  ["/api/users", [Role.SUPER_ADMIN]],
  ["/api/analytics", [Role.SUPER_ADMIN]],
  ["/sales", [Role.SALES, Role.SUPER_ADMIN]],
  ["/admin", [Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN]],
  ["/super-admin", [Role.SUPER_ADMIN]],
];

// Check if a role can access a given path
export function canAccessPath(role: Role, path: string): boolean {
  for (const [route, allowedRoles] of routeRoleEntries) {
    if (path.startsWith(route)) {
      return allowedRoles.includes(role);
    }
  }
  return true; // Paths not in the map are open to any authenticated user
}

// Role hierarchy for determining dashboard redirect
export function getDashboardPath(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "/super-admin";
    case Role.KEY_COORDINATOR:
      return "/admin";
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
