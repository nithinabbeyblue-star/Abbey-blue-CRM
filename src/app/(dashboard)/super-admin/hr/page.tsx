"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDateShort } from "@/lib/date-utils";

/* ---------- Types ---------- */

interface AttendanceRecord {
  id: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  cappedHours: number | null;
  rawHours: number | null;
  autoCorrected: boolean;
  shiftMaxHours: number;
  flagged: boolean;
  autoClocked: boolean;
  user: { name: string };
}

interface LeaveRequest {
  id: string;
  type: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  startDate: string;
  endDate: string;
  reason: string;
  user: { name: string };
  reviewedBy: { name: string } | null;
}

type LeaveTab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

/* ---------- Helpers ---------- */

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatHours(h: number | null): string {
  if (h === null || h === undefined) return "—";
  return `${h.toFixed(1)}h`;
}

/* ---------- Component ---------- */

export default function HRDashboardPage() {
  /* State */
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingLeave, setLoadingLeave] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [leaveTab, setLeaveTab] = useState<LeaveTab>("PENDING");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  /* Fetchers */
  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/hr/attendance?date=${todayISO()}`);
      if (res.ok) {
        const data = await res.json();
        const records: AttendanceRecord[] = data.records || [];
        setAttendance(records);
        setActiveCount(records.filter((r) => !r.clockOut).length);
      }
    } catch {
      setMessage({ text: "Failed to load attendance", type: "error" });
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const fetchLeave = useCallback(async () => {
    setLoadingLeave(true);
    try {
      const res = await fetch("/api/hr/leave");
      if (res.ok) {
        const data = await res.json();
        setLeaveRequests(data.leaveRequests || []);
      }
    } catch {
      setMessage({ text: "Failed to load leave requests", type: "error" });
    } finally {
      setLoadingLeave(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setTotalEmployees((data.users || []).length);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    fetchLeave();
    fetchUsers();
  }, [fetchAttendance, fetchLeave, fetchUsers]);

  /* Derived counts */
  const today = todayISO();
  const onLeaveToday = leaveRequests.filter(
    (r) =>
      r.status === "APPROVED" &&
      r.startDate.slice(0, 10) <= today &&
      r.endDate.slice(0, 10) >= today
  ).length;

  const pendingLeaveCount = leaveRequests.filter(
    (r) => r.status === "PENDING"
  ).length;

  /* Filtered leave by tab */
  const filteredLeave =
    leaveTab === "ALL"
      ? leaveRequests
      : leaveRequests.filter((r) => r.status === leaveTab);

  /* Leave actions */
  async function handleLeaveAction(
    id: string,
    status: "APPROVED" | "REJECTED"
  ) {
    if (
      status === "REJECTED" &&
      !confirm("Are you sure you want to reject this leave request?")
    ) {
      return;
    }

    setActionInProgress(id);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/hr/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        setMessage({
          text: `Leave request ${status.toLowerCase()} successfully`,
          type: "success",
        });
        fetchLeave();
      } else {
        const data = await res.json();
        setMessage({
          text: data.error || "Failed to update leave request",
          type: "error",
        });
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    } finally {
      setActionInProgress(null);
    }
  }

  /* Stat cards config */
  const stats = [
    {
      label: "Total Employees",
      value: loadingUsers ? "..." : String(totalEmployees),
      color: "bg-blue-500",
    },
    {
      label: "Clocked In Today",
      value: loadingAttendance ? "..." : String(activeCount),
      color: "bg-green-500",
    },
    {
      label: "On Leave Today",
      value: loadingLeave ? "..." : String(onLeaveToday),
      color: "bg-amber-500",
    },
    {
      label: "Pending Leave",
      value: loadingLeave ? "..." : String(pendingLeaveCount),
      color: "bg-red-500",
    },
  ];

  const leaveTabs: { key: LeaveTab; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ALL", label: "All" },
  ];

  const LEAVE_STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  /* ---------- Render ---------- */

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Attendance, leave management &amp; employee overview
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="flex gap-3">
          <Link
            href="/super-admin/hr/shifts"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
          >
            Shift Schedule
          </Link>
          <Link
            href="/super-admin/hr/attendance"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
          >
            All Attendance
          </Link>
        </div>
      </div>

      {/* Message Banner */}
      {message.text && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{stat.label}</p>
              <div className={`h-3 w-3 rounded-full ${stat.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Today's Attendance */}
      <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Today&apos;s Attendance
          </h2>
          <span className="text-sm text-muted">{todayISO()}</span>
        </div>

        {loadingAttendance ? (
          <div className="py-16 text-center text-sm text-muted">
            Loading attendance...
          </div>
        ) : attendance.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            No attendance records for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Employee Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Clock In
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Clock Out
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Hours Worked
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((rec) => {
                  const isFlagged = rec.flagged || rec.autoClocked || rec.autoCorrected;
                  const displayHours = rec.cappedHours ?? rec.totalHours;

                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-border last:border-0 ${
                        isFlagged
                          ? "bg-yellow-50"
                          : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {rec.user.name}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatTime(rec.clockIn)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatTime(rec.clockOut)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <span>{formatHours(displayHours)}</span>
                        {rec.autoCorrected && rec.rawHours != null && (
                          <span className="ml-1.5 text-[11px] text-gray-400 line-through">
                            {rec.rawHours.toFixed(1)}h
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rec.autoCorrected ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                            title={`Capped to ${rec.shiftMaxHours}h shift limit (actual: ${rec.rawHours?.toFixed(1)}h)`}
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Auto-Corrected
                          </span>
                        ) : rec.autoClocked ? (
                          <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            Auto-Clocked
                          </span>
                        ) : rec.flagged ? (
                          <span className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-medium text-yellow-700">
                            Flagged
                          </span>
                        ) : !rec.clockOut ? (
                          <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Requests */}
      <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Leave Requests
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {leaveTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLeaveTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  leaveTab === tab.key
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.key === "PENDING" && pendingLeaveCount > 0 && (
                  <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingLeaveCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loadingLeave ? (
          <div className="py-16 text-center text-sm text-muted">
            Loading leave requests...
          </div>
        ) : filteredLeave.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">
            No {leaveTab === "ALL" ? "" : leaveTab.toLowerCase() + " "}leave
            requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Start Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    End Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeave.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {req.user.name}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {req.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDateShort(req.startDate)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDateShort(req.endDate)}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                      {req.reason || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                          LEAVE_STATUS_COLORS[req.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === "PENDING" ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() =>
                              handleLeaveAction(req.id, "APPROVED")
                            }
                            disabled={actionInProgress === req.id}
                            className="rounded border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            {actionInProgress === req.id
                              ? "..."
                              : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              handleLeaveAction(req.id, "REJECTED")
                            }
                            disabled={actionInProgress === req.id}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {actionInProgress === req.id
                              ? "..."
                              : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          {req.reviewedBy
                            ? `by ${req.reviewedBy.name}`
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
