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

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

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

        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await createAuditLog({
            action: "LOGIN_FAILED",
            userId: user.id,
            newValue: "Invalid password",
            ipAddress: ip,
            userAgent: device,
          });
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
        };
      },
    }),
  ],
});
