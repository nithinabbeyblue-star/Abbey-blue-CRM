"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useHRView, type HRView } from "./hr-view-context";
import {
  Clock,
  LogOut,
  Pause,
  Play,
  Power,
  PowerOff,
  CalendarDays,
  FileText,
  CalendarPlus,
  Users,
  LayoutGrid,
  Shield,
  ChevronUp,
} from "lucide-react";

interface ActiveSession {
  id: string;
  clockIn: string;
  clockOut?: string | null;
  onBreak?: boolean;
  breakStart?: string | null;
  breakHours?: number | null;
}

const MANAGER_ROLES = ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER"];

function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getHRBasePath(role: string): string {
  if (role === "SUPER_ADMIN") return "/super-admin/hr";
  if (role === "SALES" || role === "SALES_MANAGER") return "/sales/hr";
  return "/admin/hr";
}

interface ClockInButtonProps {
  userRole: string;
  userName: string;
  userId: string;
  onLogout: () => void;
}

export function ClockInButton({ userRole, userName, userId, onLogout }: ClockInButtonProps) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [breakElapsed, setBreakElapsed] = useState("00:00:00");
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { activeView, setActiveView } = useHRView();
  const isManager = MANAGER_ROLES.includes(userRole);
  const hrBase = getHRBasePath(userRole);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch active session
  useEffect(() => {
    fetch(`/api/hr/attendance?date=${getTodayDate()}`)
      .then((r) => r.json())
      .then((data) => setSession(data.activeSession || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (session?.clockIn && !session.clockOut) {
      const clockInTime = new Date(session.clockIn).getTime();
      function tick() {
        const now = Date.now();
        setElapsed(formatElapsed(now - clockInTime));
        if (session?.onBreak && session.breakStart) {
          setBreakElapsed(formatElapsed(now - new Date(session.breakStart).getTime()));
        } else {
          setBreakElapsed("00:00:00");
        }
      }
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed("00:00:00");
      setBreakElapsed("00:00:00");
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

  function showStatus(msg: string) {
    setStatus(msg);
    if (statusRef.current) clearTimeout(statusRef.current);
    statusRef.current = setTimeout(() => setStatus(null), 3000);
  }

  async function handleClockToggle() {
    setActing(true);
    try {
      const res = await fetch("/api/hr/attendance", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.action === "clock_in") {
          setSession(data.record);
          showStatus("Clocked in");
        } else {
          setSession(null);
          showStatus("Clocked out");
        }
      } else {
        const errText = await res.text();
        let errMsg = "Error";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch { errMsg = errText || errMsg; }
        showStatus(errMsg);
      }
    } catch { showStatus("Network error"); }
    setActing(false);
  }

  async function handleBreakToggle() {
    setActing(true);
    const action = session?.onBreak ? "end_break" : "start_break";
    try {
      const res = await fetch("/api/hr/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data.record);
        showStatus(action === "start_break" ? "Break started" : "Break ended");
      } else {
        const errText = await res.text();
        let errMsg = "Error";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch { errMsg = errText || errMsg; }
        showStatus(errMsg);
      }
    } catch { showStatus("Network error"); }
    setActing(false);
  }

  function handleHRView(view: HRView) {
    setActiveView(view);
    setMenuOpen(false);
  }

  const isClockedIn = session && !session.clockOut;
  const isOnBreak = session?.onBreak;

  // Status dot color
  const dotColor = isOnBreak
    ? "bg-yellow-400 animate-pulse"
    : isClockedIn
      ? "bg-green-400"
      : "bg-gray-500";

  // Status text
  const statusText = loading
    ? "..."
    : isOnBreak
      ? "On Break"
      : isClockedIn
        ? `Working ${elapsed}`
        : "Off Duty";

  // HR menu item style helper
  function hrItemClass(view: HRView) {
    const isActive = activeView === view;
    return `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
      isActive
        ? "bg-white/15 text-white"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    }`;
  }

  function hrIconClass(view: HRView) {
    return `h-4 w-4 shrink-0 ${activeView === view ? "text-white" : "text-white/50"}`;
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* ── Trigger Row ── */}
      <div className="flex w-full items-center gap-3 rounded-lg px-1 py-1">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMenuOpen(!menuOpen)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setMenuOpen(!menuOpen); }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg py-0.5 transition-all duration-200 hover:bg-white/10"
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white/25 to-white/10 text-sm font-bold text-white ring-2 ring-white/10">
              {userName.charAt(0).toUpperCase()}
            </div>
            {/* Status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar ${dotColor}`} />
            {/* Admin badge */}
            {isManager && (
              <div className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow-sm">
                <Shield className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-[10px] text-sidebar-text">{statusText}</p>
          </div>

          <ChevronUp className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${menuOpen ? "rotate-0" : "rotate-180"}`} />
        </div>

        <NotificationBell userId={userId} userRole={userRole} />
      </div>

      {/* ── Dropdown Panel (opens upward with animation) ── */}
      <div
        className={`absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-white/10 bg-sidebar shadow-2xl shadow-black/30 transition-all duration-200 ease-out ${
          menuOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        {/* ── Header ── */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{userName}</p>
            {isManager && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                Admin
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-white/40">{userRole.replace(/_/g, " ")}</p>
        </div>

        {/* ── Live Timer ── */}
        {isClockedIn && (
          <div className="border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-white/40">Session</span>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-green-400">{elapsed}</span>
            </div>
            {isOnBreak && (
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider text-yellow-400/70">Break</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-yellow-400">{breakElapsed}</span>
              </div>
            )}
            {!isOnBreak && session.breakHours != null && session.breakHours > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Total Break</span>
                <span className="font-mono text-xs tabular-nums text-white/50">{session.breakHours.toFixed(1)}h</span>
              </div>
            )}
          </div>
        )}

        {/* ── Clock Actions — 2x2 grid ── */}
        <div className="border-b border-white/10 p-2">
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-widest text-white/30">Time Clock</p>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={!isClockedIn ? handleClockToggle : undefined}
              disabled={acting || !!isClockedIn}
              className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all duration-150 ${
                !isClockedIn
                  ? "text-green-400 hover:bg-green-500/15"
                  : "cursor-not-allowed text-white/15"
              }`}
            >
              <Power className="h-4 w-4" />
              Clock In
            </button>

            <button
              onClick={isClockedIn && !isOnBreak ? handleClockToggle : undefined}
              disabled={acting || !isClockedIn || !!isOnBreak}
              className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all duration-150 ${
                isClockedIn && !isOnBreak
                  ? "text-red-400 hover:bg-red-500/15"
                  : "cursor-not-allowed text-white/15"
              }`}
            >
              <PowerOff className="h-4 w-4" />
              Clock Out
            </button>

            <button
              onClick={isClockedIn && !isOnBreak ? handleBreakToggle : undefined}
              disabled={acting || !isClockedIn || !!isOnBreak}
              className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all duration-150 ${
                isClockedIn && !isOnBreak
                  ? "text-yellow-400 hover:bg-yellow-500/15"
                  : "cursor-not-allowed text-white/15"
              }`}
            >
              <Pause className="h-4 w-4" />
              Start Break
            </button>

            <button
              onClick={isOnBreak ? handleBreakToggle : undefined}
              disabled={acting || !isOnBreak}
              className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all duration-150 ${
                isOnBreak
                  ? "text-blue-400 hover:bg-blue-500/15"
                  : "cursor-not-allowed text-white/15"
              }`}
            >
              <Play className="h-4 w-4" />
              End Break
            </button>
          </div>
        </div>

        {/* ── Personal HR (inline views via context) ── */}
        <div className="border-b border-white/10 p-2">
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-widest text-white/30">My HR</p>
          <button onClick={() => handleHRView("attendance")} className={hrItemClass("attendance")}>
            <CalendarDays className={hrIconClass("attendance")} />
            My Attendance
            {activeView === "attendance" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
          <button onClick={() => handleHRView("leave")} className={hrItemClass("leave")}>
            <FileText className={hrIconClass("leave")} />
            My Leave
            {activeView === "leave" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
          <button onClick={() => handleHRView("request")} className={hrItemClass("request")}>
            <CalendarPlus className={hrIconClass("request")} />
            Request Leave
            {activeView === "request" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
        </div>

        {/* ── HR Management (Super Admin — full editing access) ── */}
        {userRole === "SUPER_ADMIN" && (
          <div className="border-b border-white/10 bg-amber-500/[0.03] p-2">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-widest text-amber-400/60">
              <Shield className="h-3 w-3" />
              HR Management
            </p>
            <Link
              href="/super-admin/hr"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-300/70 transition-all duration-150 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              HR Dashboard
            </Link>
            <Link
              href="/super-admin/hr/attendance"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-300/70 transition-all duration-150 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Clock className="h-4 w-4 shrink-0" />
              Attendance Records
            </Link>
            <Link
              href="/super-admin/hr/shifts"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-300/70 transition-all duration-150 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              Shift Planner
            </Link>
            <Link
              href="/super-admin/hr"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-300/70 transition-all duration-150 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Users className="h-4 w-4 shrink-0" />
              Leave Requests
            </Link>
          </div>
        )}

        {/* ── Team Oversight (Managers — read-only schedule + team status) ── */}
        {isManager && userRole !== "SUPER_ADMIN" && (
          <div className="border-b border-white/10 bg-blue-500/[0.03] p-2">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-widest text-blue-400/60">
              <Users className="h-3 w-3" />
              Team Oversight
            </p>
            <Link
              href={`${hrBase}/shifts`}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-blue-300/70 transition-all duration-150 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              Team Schedule
              <span className="ml-auto rounded bg-blue-500/20 px-1 py-0.5 text-[8px] font-bold uppercase text-blue-400">View</span>
            </Link>
            <Link
              href={hrBase}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-blue-300/70 transition-all duration-150 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              Team Dashboard
            </Link>
          </div>
        )}

        {/* ── Sign Out ── */}
        <div className="p-2">
          <button
            onClick={() => { setMenuOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400/70 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>

        {/* ── Status Toast ── */}
        {status && (
          <div className={`border-t border-white/10 px-3 py-2 transition-all duration-200 ${
            status.includes("error") || status.includes("Error") || status.includes("already") || status.includes("No active") || status.includes("must")
              ? "bg-red-500/10"
              : "bg-green-500/10"
          }`}>
            <p className="text-center text-xs text-white/80">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
