"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [status, setStatus] = useState<string>("PENDING");
  const [requestSent, setRequestSent] = useState(false);
  const [approved, setApproved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send access request on mount
  useEffect(() => {
    if (!email || requestSent) return;

    fetch("/api/auth/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).finally(() => setRequestSent(true));
  }, [email, requestSent]);

  // Poll for status changes
  const checkStatus = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(`/api/auth/check-status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.status === "ACTIVE") {
          setApproved(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => router.push("/login?approved=1"), 2000);
        }
      }
    } catch {
      // Polling failure is non-critical
    }
  }, [email, router]);

  useEffect(() => {
    if (!email) return;
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [email, checkStatus]);

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
            <p className="text-sm text-muted">No email provided.</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
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

          {approved ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-green-700">Access Approved!</h2>
              <p className="mt-2 text-sm text-muted">Redirecting to login...</p>
            </div>
          ) : (
            <div className="text-center">
              {/* Pulsing animation */}
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                <div className="absolute h-16 w-16 animate-ping rounded-full bg-amber-200 opacity-50" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-foreground">Access Request Sent</h2>
              <p className="mt-2 text-sm text-muted">
                Your administrator has been notified. This page will update automatically when your access is approved.
              </p>

              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-700">
                  Status: <span className="font-semibold">{status === "PENDING" ? "Waiting for approval" : status}</span>
                </p>
              </div>

              <p className="mt-4 text-xs text-muted">
                Checking every 10 seconds...
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-primary hover:underline"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense>
      <WaitingRoomContent />
    </Suspense>
  );
}
