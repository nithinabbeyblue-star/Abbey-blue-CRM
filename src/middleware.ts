import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData } from "@/lib/auth";
import { canAccessPath, getDashboardPath } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";

// Paths that don't require authentication
const publicPaths = ["/login", "/api/auth/login", "/api/webhooks"];

function isPublicPath(path: string): boolean {
  return publicPaths.some((p) => path.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Get session from cookie
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    {
      password: process.env.SESSION_SECRET!,
      cookieName: "abbey-crm-session",
    }
  );

  const isApiRoute = pathname.startsWith("/api/");

  // Not logged in → redirect to login (or JSON 401 for API routes)
  if (!session.isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root path → redirect to role-based dashboard
  if (pathname === "/") {
    const dashboardPath = getDashboardPath(session.role as Role);
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // RBAC check — does this role have access to this path?
  if (!canAccessPath(session.role as Role, pathname)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const dashboardPath = getDashboardPath(session.role as Role);
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
