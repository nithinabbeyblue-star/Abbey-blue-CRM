"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(() => {
    const p = searchParams;
    if (p.get("approved") === "1") return "Your access has been approved! Please sign in.";
    if (p.get("passwordChanged") === "1") return "Password changed successfully. Please sign in with your new password.";
    if (p.get("reason") === "session_invalid") return "Your session is no longer valid (e.g. account deactivated or session expired). Please sign in again.";
    return "";
  });
  const [loading, setLoading] = useState(false);

  // Clear any stale session when user was kicked out (suspended / session invalid)
  useEffect(() => {
    if (searchParams.get("reason") === "session_invalid") {
      signOut({ redirect: false });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const errMsg = result.error;

        if (errMsg.includes("PENDING_ACTIVATION")) {
          router.push(`/activate?email=${encodeURIComponent(email)}`);
          return;
        }
        if (errMsg.includes("PENDING_APPROVAL")) {
          router.push(`/waiting-room?email=${encodeURIComponent(email)}`);
          return;
        }
        if (errMsg.includes("ACCOUNT_SUSPENDED")) {
          setError("Your account has been deactivated. Contact your administrator.");
          return;
        }
        if (errMsg.includes("LOGIN_UNAVAILABLE")) {
          setError("Login is temporarily unavailable. Please try again later or contact support.");
          return;
        }

        setError(
          process.env.NODE_ENV === "development" && errMsg
            ? `Login failed: ${errMsg}`
            : "Invalid email or password. If you were approved recently, ask an admin to confirm your account is ACTIVE and you have set your password."
        );
        return;
      }

      if (!result?.ok) {
        setError("Sign-in did not complete. Please try again.");
        return;
      }

      // Full page redirect so the session cookie is sent on the next request (fixes Vercel/production needing multiple sign-ins)
      const callbackUrl = searchParams.get("callbackUrl");
      const target = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
      window.location.href = target;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">
              A
            </div>
            <h1 className="text-2xl font-bold text-foreground">Abbey CRM</h1>
            <p className="mt-1 text-sm text-muted">Visa Processing System</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              searchParams.get("approved") || searchParams.get("passwordChanged")
                ? "border-green-200 bg-green-50 text-green-700"
                : searchParams.get("reason") === "session_invalid"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}>
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@abbeylegal.com"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Contact your administrator for access credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
