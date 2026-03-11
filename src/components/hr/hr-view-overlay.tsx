"use client";

import { useState, useEffect } from "react";
import { useHRView } from "./hr-view-context";
import { LeaveRequestForm } from "./leave-request-form";
import { X, CalendarDays, FileText, CalendarPlus } from "lucide-react";

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
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

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
  reviewedBy: { name: string } | null;
}

interface HRViewOverlayProps {
  children: React.ReactNode;
}

export function HRViewOverlay({ children }: HRViewOverlayProps) {
  const { activeView, setActiveView } = useHRView();

  if (!activeView) return <>{children}</>;

  return (
    <div>
      {/* View Header with close + tab switcher */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView(null)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
            title="Close HR view"
          >
            <X className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {activeView === "attendance" && "My Attendance"}
            {activeView === "leave" && "My Leave"}
            {activeView === "request" && "Request Leave"}
          </h1>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 rounded-lg border border-border bg-gray-50 p-1">
          <TabButton
            active={activeView === "attendance"}
            onClick={() => setActiveView("attendance")}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Attendance"
          />
          <TabButton
            active={activeView === "leave"}
            onClick={() => setActiveView("leave")}
            icon={<FileText className="h-3.5 w-3.5" />}
            label="My Leave"
          />
          <TabButton
            active={activeView === "request"}
            onClick={() => setActiveView("request")}
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            label="Request"
          />
        </div>
      </div>

      {/* Active view content */}
      {activeView === "attendance" && <AttendanceView />}
      {activeView === "leave" && <LeaveView />}
      {activeView === "request" && <RequestLeaveView />}
    </div>
  );
}

/* ── Tab Button ── */

function TabButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Attendance View ── */

function AttendanceView() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/hr/attendance?month=${month}`)
      .then((r) => r.json())
      .then((data) => setRecords(data.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [month]);

  function changeMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]) - 1
  ).toLocaleDateString("en-IE", { month: "long", year: "numeric" });

  // Stats
  const totalHours = records.reduce((s, a) => s + (a.totalHours || 0), 0);
  const daysWorked = records.filter((a) => a.clockOut).length;

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          <p className="text-xs font-medium text-muted">Avg Hours/Day</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : "0.0"}
          </p>
          <p className="text-xs text-muted">{monthLabel}</p>
        </div>
      </div>

      {/* Table */}
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
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No records this month</td></tr>
              ) : (
                records.map((a) => (
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
    </div>
  );
}

/* ── Leave View ── */

function LeaveView() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/hr/leave")
      .then((r) => r.json())
      .then((data) => setLeaves(data.leaveRequests || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  }, []);

  const pending = leaves.filter((l) => l.status === "PENDING").length;
  const approved = leaves.filter((l) => l.status === "APPROVED").length;

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Pending Requests</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{pending}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Approved Leave</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{approved}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">My Leave Requests</h2>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No leave requests</td></tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{LEAVE_TYPE_LABELS[l.type] || l.type}</td>
                    <td className="px-4 py-2.5">{new Date(l.startDate).toLocaleDateString("en-IE")}</td>
                    <td className="px-4 py-2.5">{new Date(l.endDate).toLocaleDateString("en-IE")}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[l.status] || "bg-gray-100 text-gray-800"}`}>
                        {STATUS_LABELS[l.status] || l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{l.reviewNotes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Request Leave View ── */

function RequestLeaveView() {
  const { setActiveView } = useHRView();

  return (
    <LeaveRequestForm onSuccess={() => setActiveView("leave")} />
  );
}
