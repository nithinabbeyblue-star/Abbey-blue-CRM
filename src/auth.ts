import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createAuditLog, extractIp, extractDevice } from "@/lib/audit";
import { authConfig } from "@/auth.config";

declare module "next-auth" {
  interface User {
    role: string;
    sessionVersion: number;
    mustSetPassword: boolean;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      sessionVersion: number;
      mustSetPassword: boolean;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = (credentials?.email as string)?.toLowerCase();
        const password = credentials?.password as string;
        if (!email || !password) return null;

        try {
          const user = await db.user.findUnique({ where: { email } });
          if (!user) {
            if (process.env.NODE_ENV === "development") {
              console.warn("[Auth] Login rejected: no user with this email.");
            }
            return null;
          }

        // Extract request info for audit logging
        const headers = request?.headers ? new Headers(request.headers) : new Headers();
        const ip = extractIp(headers);
        const device = extractDevice(headers);

        if (user.status === "SUSPENDED") {
          await createAuditLog({
            action: "LOGIN_BLOCKED",
            userId: user.id,
            newValue: "Account suspended",
            ipAddress: ip,
            userAgent: device,
          });
          throw new Error("ACCOUNT_SUSPENDED");
        }

        if (user.status === "PENDING" && !user.passwordHash) {
          throw new Error("PENDING_ACTIVATION");
        }

        if (!user.passwordHash) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[Auth] Login rejected: user has no password set. Set one via /activate or in DB.");
          }
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await createAuditLog({
            action: "LOGIN_FAILED",
            userId: user.id,
            newValue: "Invalid password",
            ipAddress: ip,
            userAgent: device,
          });
          if (process.env.NODE_ENV === "development") {
            console.warn("[Auth] Login rejected: invalid password for this user.");
          }
          return null;
        }

        if (user.status === "PENDING") {
          await createAuditLog({
            action: "LOGIN_BLOCKED",
            userId: user.id,
            newValue: "Pending admin approval",
            ipAddress: ip,
            userAgent: device,
          });
          throw new Error("PENDING_APPROVAL");
        }

        // Successful login
        await createAuditLog({
          action: "LOGIN_SUCCESS",
          userId: user.id,
          ipAddress: ip,
          userAgent: device,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
          mustSetPassword: user.mustSetPassword,
        };
        } catch (err) {
          // Re-throw known auth errors so the login page can distinguish them
          if (err instanceof Error) {
            const known = ["PENDING_ACTIVATION", "PENDING_APPROVAL", "ACCOUNT_SUSPENDED"];
            if (known.includes(err.message)) throw err;
          }
          console.error("[Auth] Login error:", err);
          throw new Error("LOGIN_UNAVAILABLE");
        }
      },
    }),
  ],
});
