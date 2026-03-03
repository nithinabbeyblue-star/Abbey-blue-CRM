import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/enums";

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: Role;
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "abbey-crm-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    isLoggedIn: true,
  };
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
