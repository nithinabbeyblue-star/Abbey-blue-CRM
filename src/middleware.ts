import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Paths that don't require authentication
const publicPaths = ["/login", "/activate", "/waiting-room", "/change-password", "/api/auth", "/api/debug-env"];

function isPublicPath(path: string): boolean {
  return publicPaths.some((p) => path.startsWith(p));
}

// Role → dashboard path mapping (duplicated from rbac to avoid importing non-edge modules)
function getDashboardForRole(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "ADMIN_MANAGER":
      return "/admin";
    case "SALES_MANAGER":
      return "/sales";
    case "ADMIN":
      return "/admin";
    case "SALES":
      return "/sales";
    default:
      return "/login";
  }
}

// Role → allowed path prefixes (duplicated to keep middleware edge-compatible)
const rolePathMap: Record<string, string[]> = {
  SUPER_ADMIN: ["/super-admin", "/api/"],
  ADMIN_MANAGER: ["/admin", "/api/"],
  SALES_MANAGER: ["/sales", "/api/"],
  ADMIN: ["/admin", "/api/"],
  SALES: ["/sales", "/api/"],
};

function canAccess(role: string, pathname: string): boolean {
  const allowed = rolePathMap[role];
  if (!allowed) return false;
  return allowed.some((p) => pathname.startsWith(p));
}

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");
  const user = request.auth?.user;

  // Not logged in → redirect to login (or JSON 401 for API routes)
  if (!user) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change — if mustSetPassword is true, only allow /change-password and /api/auth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mustChange = (user as any)?.mustSetPassword === true;
  if (mustChange && !pathname.startsWith("/change-password") && !pathname.startsWith("/api/auth")) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  // Root path → always go to login so users pick their account
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // RBAC check — does this role have access to this path?
  if (!canAccess(user.role, pathname)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const dashboardPath = getDashboardForRole(user.role);
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)$).*)",
  ],
};
