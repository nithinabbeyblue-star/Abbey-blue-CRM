"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { LeaveRequestForm } from "./leave-request-form";

// ── Constants ────────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  PERSONAL: "Personal Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  UNPAID: "Unpaid Leave",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const DIVISION_STYLES: Record<string, string> = {
  IMMIGRATION: "bg-blue-50 text-blue-700 border-blue-200",
  FORMATIONS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
};

const DIVISION_LABELS: Record<string, string> = {
  IMMIGRATION: "Immigration",
  FORMATIONS: "Formations",
  MEDIA: "Media",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  flagged: boolean;
  autoClocked: boolean;
  date: string;
}

interface LeaveRecord {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  reviewNotes: string | null;
  createdAt: string;
  userId: string;
  reviewedBy: { name: string } | null;
  user?: { id: string; name: string; role?: string; division?: string | null };
}

interface MyHRPageProps {
  userRole: string;
  userId?: string;
}

type TabType = "attendance" | "personal-leave" | "request" | "team-queue";
type TeamFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type DivisionFilter = "ALL" | "IMMIGRATION" | "FORMATIONS" | "MEDIA";

// ── Helpers ──────────────────────────────────────────────────────────────────

function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

function formatDateIE(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function MyHRPage({ userRole, userId }: MyHRPageProps) {
  const [tab, setTab] = useState<TabType>("attendance");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [personalLeaves, setPersonalLeaves] = useState<LeaveRecord[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRecord[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(true);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("PENDING");
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>("ALL");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const isManager = ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER"].includes(userRole);

  // ── Data Fetchers ────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadingAtt(true);
    fetch(`/api/hr/attendance?month=${month}`)
      .then((r) => r.json())
      .then((data) => setAttendance(data.records || []))
      .catch(() => setAttendance([]))
      .finally(() => setLoadingAtt(false));
  }, [month]);

  const fetchPersonalLeaves = useCallback(() => {
    setLoadingPersonal(true);
    fetch("/api/hr/leave?scope=personal")
      .then((r) => r.json())
      .then((data) => setPersonalLeaves(data.leaveRequests || []))
      .catch(() => setPersonalLeaves([]))
      .finally(() => setLoadingPersonal(false));
  }, []);

  const fetchTeamLeaves = useCallback(() => {
    if (!isManager) return;
    setLoadingTeam(true);
    fetch("/api/hr/leave?scope=team")
      .then((r) => r.json())
      .then((data) => setTeamLeaves(data.leaveRequests || []))
      .catch(() => setTeamLeaves([]))
      .finally(() => setLoadingTeam(false));
  }, [isManager]);

  useEffect(() => { fetchPersonalLeaves(); }, [fetchPersonalLeaves]);
  useEffect(() => { fetchTeamLeaves(); }, [fetchTeamLeaves]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function refreshAfterRequest() {
    fetchPersonalLeaves();
    setTab("personal-leave");
  }

  async function handleCancelLeave(id: string) {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    setActionInProgress(id);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch(`/api/hr/leave?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ text: "Leave request cancelled", type: "success" });
        fetchPersonalLeaves();
        if (isManager) fetchTeamLeaves();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to cancel", type: "error" });
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleLeaveAction(id: string, status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !confirm("Reject this leave request?")) return;
    setActionInProgress(id);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch("/api/hr/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setMessage({ text: `Leave ${status.toLowerCase()} successfully`, type: "success" });
        fetchTeamLeaves();
        fetchPersonalLeaves();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to update", type: "error" });
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    } finally {
      setActionInProgress(null);
    }
  }

  // ── Derived Data ─────────────────────────────────────────────────────────

  const monthLabel = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]) - 1
  ).toLocaleDateString("en-IE", { month: "long", year: "numeric" });

  const totalHours = attendance.reduce((s, a) => s + (a.totalHours || 0), 0);
  const daysWorked = attendance.filter((a) => a.clockOut).length;
  const pendingPersonal = personalLeaves.filter((l) => l.status === "PENDING").length;
  const approvedPersonal = personalLeaves.filter((l) => l.status === "APPROVED").length;
  const pendingTeam = teamLeaves.filter((l) => l.status === "PENDING").length;

  // Team leaves filtered by status + division
  const filteredTeamLeaves = useMemo(() => {
    let filtered = teamLeaves;
    if (teamFilter !== "ALL") {
      filtered = filtered.filter((l) => l.status === teamFilter);
    }
    if (divisionFilter !== "ALL") {
      filtered = filtered.filter((l) => l.user?.division === divisionFilter);
    }
    return filtered;
  }, [teamLeaves, teamFilter, divisionFilter]);

  // Conflict detection: for each team leave, count how many other team members
  // have approved/pending leave on overlapping dates
  const conflictMap = useMemo(() => {
    const map = new Map<string, number>();
    const activeLeaves = teamLeaves.filter(
      (l) => l.status === "APPROVED" || l.status === "PENDING"
    );
    for (const leave of activeLeaves) {
      let count = 0;
      for (const other of activeLeaves) {
        if (other.id === leave.id) continue;
        if (other.userId === leave.userId) continue;
        if (
          datesOverlap(
            leave.startDate.slice(0, 10),
            leave.endDate.slice(0, 10),
            other.startDate.slice(0, 10),
            other.endDate.slice(0, 10)
          )
        ) {
          count++;
        }
      }
      map.set(leave.id, count);
    }
    return map;
  }, [teamLeaves]);

  // ── Tab Configuration ────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: "attendance", label: "My Attendance" },
    { key: "personal-leave", label: "My Personal Requests", badge: pendingPersonal || undefined },
    { key: "request", label: "Request Leave" },
    ...(isManager
      ? [{ key: "team-queue" as const, label: "Team Approval Queue", badge: pendingTeam || undefined }]
      : []),
  ];

  const teamStatusTabs: { key: TeamFilter; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ALL", label: "All" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">My HR</h1>
      <p className="mb-6 text-sm text-muted">
        {isManager ? "Personal leave & team approval management" : "Attendance, leave requests & history"}
      </p>

      {/* Message Banner */}
      {message.text && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Days Worked</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{daysWorked}</p>
          <p className="text-xs text-muted">{monthLabel}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Total Hours</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalHours.toFixed(1)}</p>
          <p className="text-xs text-muted">{monthLabel}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">My Pending</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{pendingPersonal}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">
            {isManager ? "Team Pending" : "Approved Leave"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${isManager ? "text-red-600" : "text-green-600"}`}>
            {isManager ? pendingTeam : approvedPersonal}
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
            {t.badge && t.badge > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  ATTENDANCE TAB                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tab === "attendance" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Attendance History</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => changeMonth(-1)} className="rounded border border-border px-2 py-1 text-xs hover:bg-gray-50">&larr;</button>
              <span className="min-w-[120px] text-center text-xs font-medium">{monthLabel}</span>
              <button onClick={() => changeMonth(1)} className="rounded border border-border px-2 py-1 text-xs hover:bg-gray-50">&rarr;</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Clock In</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Clock Out</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Hours</th>
                </tr>
              </thead>
              <tbody>
                {loadingAtt ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
                ) : attendance.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No records this month</td></tr>
                ) : (
                  attendance.map((a) => (
                    <tr key={a.id} className={`border-b border-border last:border-0 ${a.flagged ? "bg-yellow-50" : ""}`}>
                      <td className="px-4 py-2.5">{new Date(a.date).toLocaleDateString("en-IE")}</td>
                      <td className="px-4 py-2.5">{new Date(a.clockIn).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2.5">
                        {a.clockOut
                          ? new Date(a.clockOut).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })
                          : <span className="font-medium text-green-600">Active</span>}
                      </td>
                      <td className="px-4 py-2.5">{a.totalHours != null ? `${a.totalHours.toFixed(1)}h` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  MY PERSONAL REQUESTS TAB                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tab === "personal-leave" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">My Personal Requests</h2>
            <p className="mt-0.5 text-xs text-muted">Your leave history and pending requests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">From</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">To</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Review Notes</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingPersonal ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
                ) : personalLeaves.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No leave requests yet</td></tr>
                ) : (
                  personalLeaves.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">{LEAVE_TYPE_LABELS[l.type] || l.type}</td>
                      <td className="px-4 py-2.5">{formatDateIE(l.startDate)}</td>
                      <td className="px-4 py-2.5">{formatDateIE(l.endDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[l.status] || "bg-gray-100 text-gray-800"}`}>
                          {STATUS_LABELS[l.status] || l.status}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-muted">{l.reviewNotes || "—"}</td>
                      <td className="px-4 py-2.5">
                        {l.status === "PENDING" ? (
                          <button
                            onClick={() => handleCancelLeave(l.id)}
                            disabled={actionInProgress === l.id}
                            className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {actionInProgress === l.id ? "..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted">
                            {l.reviewedBy ? `by ${l.reviewedBy.name}` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  REQUEST LEAVE TAB                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tab === "request" && (
        <LeaveRequestForm onSuccess={refreshAfterRequest} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  TEAM APPROVAL QUEUE TAB (Managers Only)                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tab === "team-queue" && isManager && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Team Approval Queue</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {userRole === "SALES_MANAGER"
                    ? "Sales team leave requests"
                    : "All company leave requests"}
                  {userRole !== "SUPER_ADMIN" && " — Medical reports restricted to Super Admin"}
                </p>
              </div>

              {/* Division Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted">Division:</span>
                <select
                  value={divisionFilter}
                  onChange={(e) => setDivisionFilter(e.target.value as DivisionFilter)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                >
                  <option value="ALL">All Divisions</option>
                  <option value="IMMIGRATION">Immigration</option>
                  <option value="FORMATIONS">Formations</option>
                  <option value="MEDIA">Media</option>
                </select>
              </div>
            </div>

            {/* Status Sub-Tabs */}
            <div className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1">
              {teamStatusTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTeamFilter(t.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    teamFilter === t.key
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {t.key === "PENDING" && pendingTeam > 0 && (
                    <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {pendingTeam}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Employee</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Division</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">From</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">To</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Reason</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingTeam ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
                ) : filteredTeamLeaves.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No {teamFilter === "ALL" ? "" : teamFilter.toLowerCase() + " "}leave requests
                    {divisionFilter !== "ALL" ? ` in ${DIVISION_LABELS[divisionFilter]}` : ""}
                  </td></tr>
                ) : (
                  filteredTeamLeaves.map((l) => {
                    const conflictCount = conflictMap.get(l.id) || 0;
                    const hasConflict = conflictCount >= 2;
                    const division = l.user?.division;

                    return (
                      <tr
                        key={l.id}
                        className={`border-b border-border last:border-0 ${
                          hasConflict ? "bg-orange-50/60" : "hover:bg-gray-50/50"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {l.user?.name || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {division ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIVISION_STYLES[division] || "bg-gray-100 text-gray-600"}`}>
                              {DIVISION_LABELS[division] || division}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">{LEAVE_TYPE_LABELS[l.type] || l.type}</td>
                        <td className="px-4 py-2.5">{formatDateIE(l.startDate)}</td>
                        <td className="px-4 py-2.5">{formatDateIE(l.endDate)}</td>
                        <td className="max-w-[180px] truncate px-4 py-2.5 text-muted">
                          {l.reason || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[l.status] || "bg-gray-100 text-gray-800"}`}>
                            {STATUS_LABELS[l.status] || l.status}
                          </span>
                          {/* Conflict Warning */}
                          {hasConflict && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-orange-700">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {conflictCount} others off
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {l.status === "PENDING" ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleLeaveAction(l.id, "APPROVED")}
                                disabled={actionInProgress === l.id}
                                className="rounded border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                              >
                                {actionInProgress === l.id ? "..." : "Approve"}
                              </button>
                              <button
                                onClick={() => handleLeaveAction(l.id, "REJECTED")}
                                disabled={actionInProgress === l.id}
                                className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {actionInProgress === l.id ? "..." : "Reject"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">
                              {l.reviewedBy ? `by ${l.reviewedBy.name}` : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
