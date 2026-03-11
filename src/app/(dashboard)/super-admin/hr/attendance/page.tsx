"use client";

import { useState, useEffect } from "react";

interface AttendanceRecord {
  id: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  autoClocked: boolean;
  flagged: boolean;
  notes: string | null;
  date: string;
  user: { name: string };
}

export default function AttendanceHistoryPage() {
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

  const monthLabel = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1).toLocaleDateString("en-IE", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Attendance History</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => changeMonth(-1)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50">&larr;</button>
          <span className="min-w-[140px] text-center text-sm font-medium">{monthLabel}</span>
          <button onClick={() => changeMonth(1)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50">&rarr;</button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Clock In</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Clock Out</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Hours</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No attendance records for this month</td></tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className={`border-b border-border last:border-0 ${r.flagged ? "bg-yellow-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">{r.user.name}</td>
                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString("en-IE")}</td>
                    <td className="px-4 py-3">{new Date(r.clockIn).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3">
                      {r.clockOut
                        ? new Date(r.clockOut).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })
                        : <span className="text-green-600 font-medium">Active</span>}
                    </td>
                    <td className="px-4 py-3">{r.totalHours != null ? `${r.totalHours.toFixed(1)}h` : "—"}</td>
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
