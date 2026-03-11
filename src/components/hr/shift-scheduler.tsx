"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "FULL_DAY" | "CUSTOM";

interface Shift {
  id: string;
  date: string;
  type: ShiftType;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  user: { id: string; name: string };
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  userId: string;
  user: { name: string };
}

interface User {
  id: string;
  name: string;
  role: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  NIGHT: "Night",
  FULL_DAY: "Full Day",
  CUSTOM: "Custom",
};

const SHIFT_TYPE_COLORS: Record<ShiftType, string> = {
  MORNING: "bg-blue-100 text-blue-800 border-blue-300",
  AFTERNOON: "bg-orange-100 text-orange-800 border-orange-300",
  EVENING: "bg-purple-100 text-purple-800 border-purple-300",
  NIGHT: "bg-indigo-100 text-indigo-800 border-indigo-300",
  FULL_DAY: "bg-green-100 text-green-800 border-green-300",
  CUSTOM: "bg-gray-100 text-gray-800 border-gray-300",
};

const SHIFT_TYPES: ShiftType[] = ["MORNING", "AFTERNOON", "EVENING", "NIGHT", "FULL_DAY", "CUSTOM"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  const d = new Date(dateStr);
  const s = new Date(startStr);
  const e = new Date(endStr);
  return d >= s && d <= e;
}

// ── Component ──────────────────────────────────────────────────────────────

interface ShiftSchedulerProps {
  readOnly?: boolean;
}

export function ShiftScheduler({ readOnly = false }: ShiftSchedulerProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Form state (edit modal)
  const [formUserId, setFormUserId] = useState("");
  const [formType, setFormType] = useState<ShiftType>("MORNING");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bulk add state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUserId, setBulkUserId] = useState("");
  const [bulkMonth, setBulkMonth] = useState(() => formatMonth(currentYear, currentMonth));
  const [bulkStartTime, setBulkStartTime] = useState("09:00");
  const [bulkEndTime, setBulkEndTime] = useState("17:00");
  const [bulkDays, setBulkDays] = useState([false, true, true, true, true, true, false]); // S M T W T F S
  const [bulkIncludeBreak, setBulkIncludeBreak] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkCustomDates, setBulkCustomDates] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"pattern" | "dates">("pattern");

  // ── Data fetching ──────────────────────────────────────────────────────

  const monthStr = formatMonth(currentYear, currentMonth);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsRes, leavesRes, usersRes] = await Promise.all([
        fetch(`/api/hr/shifts?month=${monthStr}`),
        fetch(`/api/hr/leave?month=${monthStr}&status=APPROVED`),
        fetch("/api/users"),
      ]);
      const shiftsData = await shiftsRes.json();
      const leavesData = await leavesRes.json();
      const usersData = await usersRes.json();

      setShifts(shiftsData.shifts ?? []);
      setLeaves(leavesData.leaveRequests ?? []);
      setUsers(usersData.users ?? []);
    } catch (err) {
      console.error("Failed to fetch shift data", err);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ───────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  // Filter shifts by search query
  const filteredShifts = useMemo(() => {
    if (!searchQuery.trim()) return shifts;
    const q = searchQuery.toLowerCase();
    return shifts.filter((s) => s.user.name.toLowerCase().includes(q));
  }, [shifts, searchQuery]);

  // Map: "YYYY-MM-DD" → Shift[]
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of filteredShifts) {
      const key = s.date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [filteredShifts]);

  // Map: userId → Set of date strings that are on approved leave
  const leaveByUser = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const l of leaves) {
      if (!map[l.userId]) map[l.userId] = new Set();
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        map[l.userId].add(toDateString(d));
      }
    }
    return map;
  }, [leaves]);

  // Set of date strings with any approved leave
  const datesWithLeave = useMemo(() => {
    const set = new Set<string>();
    for (const userId in leaveByUser) {
      for (const d of leaveByUser[userId]) {
        set.add(d);
      }
    }
    return set;
  }, [leaveByUser]);

  // Check if a specific user has leave on a specific date
  function userHasLeave(userId: string, dateStr: string): boolean {
    return leaveByUser[userId]?.has(dateStr) ?? false;
  }

  // ── Month navigation ──────────────────────────────────────────────────

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // ── Modal logic ────────────────────────────────────────────────────────

  function openBulkAdd() {
    setBulkUserId(users[0]?.id ?? "");
    setBulkMonth(formatMonth(currentYear, currentMonth));
    setBulkStartTime("09:00");
    setBulkEndTime("17:00");
    setBulkDays([false, true, true, true, true, true, false]);
    setBulkIncludeBreak(false);
    setBulkCustomDates(new Set());
    setBulkMode("pattern");
    setBulkOpen(true);
  }

  // Build all dates in the bulk month for the mini calendar
  const bulkCalendar = useMemo(() => {
    const [y, m] = bulkMonth.split("-").map(Number);
    const daysCount = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const allDates: { day: number; dateStr: string; isLeave: boolean }[] = [];
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isLeave = bulkUserId ? userHasLeave(bulkUserId, dateStr) : false;
      allDates.push({ day: d, dateStr, isLeave });
    }
    return { allDates, firstDayOfWeek, year: y, month: m };
  }, [bulkMonth, bulkUserId, leaveByUser]);

  // Calculate bulk shift summary
  const bulkSummary = useMemo(() => {
    if (!bulkOpen) return { count: 0, totalHours: 0, dates: [] as string[] };

    let dates: string[] = [];

    if (bulkMode === "dates") {
      // Use individually selected dates
      dates = Array.from(bulkCustomDates).filter(
        (dateStr) => !(bulkUserId && userHasLeave(bulkUserId, dateStr))
      ).sort();
    } else {
      // Use day-of-week pattern
      const [y, m] = bulkMonth.split("-").map(Number);
      const daysCount = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysCount; d++) {
        const date = new Date(y, m - 1, d);
        const dayOfWeek = date.getDay();
        if (!bulkDays[dayOfWeek]) continue;
        const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (bulkUserId && userHasLeave(bulkUserId, dateStr)) continue;
        dates.push(dateStr);
      }
    }

    const [sh, sm] = bulkStartTime.split(":").map(Number);
    const [eh, em] = bulkEndTime.split(":").map(Number);
    let hoursPerShift = (eh * 60 + em - sh * 60 - sm) / 60;
    if (bulkIncludeBreak) hoursPerShift = Math.max(0, hoursPerShift - 1);

    return {
      count: dates.length,
      totalHours: dates.length * Math.max(0, hoursPerShift),
      dates,
    };
  }, [bulkOpen, bulkMode, bulkMonth, bulkDays, bulkCustomDates, bulkStartTime, bulkEndTime, bulkIncludeBreak, bulkUserId, leaveByUser]);

  // Which dates are selected (for calendar highlighting)
  const bulkSelectedDatesSet = useMemo(() => {
    return new Set(bulkSummary.dates);
  }, [bulkSummary.dates]);

  function toggleBulkDate(dateStr: string) {
    setBulkCustomDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  function bulkCalendarPrev() {
    const [y, m] = bulkMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setBulkMonth(formatMonth(d.getFullYear(), d.getMonth()));
  }

  function bulkCalendarNext() {
    const [y, m] = bulkMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setBulkMonth(formatMonth(d.getFullYear(), d.getMonth()));
  }

  async function handleBulkSubmit() {
    if (bulkSummary.count === 0 || !bulkUserId) return;
    setBulkSubmitting(true);
    try {
      let successCount = 0;
      for (const dateStr of bulkSummary.dates) {
        const body = {
          userId: bulkUserId,
          date: dateStr,
          type: "CUSTOM" as ShiftType,
          startTime: bulkStartTime,
          endTime: bulkEndTime,
          notes: bulkIncludeBreak ? "Includes 1-hour unpaid break" : undefined,
        };
        const res = await fetch("/api/hr/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        setBulkOpen(false);
        fetchData();
      }
      if (successCount < bulkSummary.count) {
        alert(`${successCount} of ${bulkSummary.count} shifts created. Some may have conflicts.`);
      }
    } catch (err) {
      console.error("Bulk shift creation failed", err);
      alert("Failed to create shifts");
    } finally {
      setBulkSubmitting(false);
    }
  }

  function openEditModal(shift: Shift) {
    setEditingShift(shift);
    setSelectedDate(shift.date.split("T")[0]);
    setFormUserId(shift.user.id);
    setFormType(shift.type);
    setFormStartTime(shift.startTime ?? "09:00");
    setFormEndTime(shift.endTime ?? "17:00");
    setFormNotes(shift.notes ?? "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingShift(null);
  }

  const selectedUserOnLeave = formUserId && selectedDate ? userHasLeave(formUserId, selectedDate) : false;

  async function handleSubmit() {
    if (selectedUserOnLeave) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        userId: formUserId,
        date: selectedDate,
        type: formType,
      };
      if (formType === "CUSTOM") {
        body.startTime = formStartTime;
        body.endTime = formEndTime;
      }
      if (formNotes.trim()) {
        body.notes = formNotes.trim();
      }

      if (editingShift) {
        // For editing, delete old then create new
        await fetch(`/api/hr/shifts?id=${editingShift.id}`, { method: "DELETE" });
      }

      const res = await fetch("/api/hr/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save shift");
      } else {
        closeModal();
        fetchData();
      }
    } catch (err) {
      console.error("Failed to save shift", err);
      alert("Failed to save shift");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingShift) return;
    if (!confirm("Are you sure you want to delete this shift?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hr/shifts?id=${editingShift.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete shift");
      } else {
        closeModal();
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete shift", err);
      alert("Failed to delete shift");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Calendar cells ─────────────────────────────────────────────────────

  function buildCalendarCells() {
    const cells: (null | { day: number; dateStr: string })[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, dateStr });
    }

    return cells;
  }

  const calendarCells = buildCalendarCells();

  // ── Employee list (left sidebar) ───────────────────────────────────────

  // Gather all unique users who have shifts this month, filtered by search
  const employeesWithShifts = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of filteredShifts) {
      map.set(s.user.id, s.user.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [filteredShifts]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {readOnly ? "Team Schedule" : "Shift Scheduling"}
        {readOnly && <span className="ml-3 text-sm font-normal text-gray-400">(View Only)</span>}
      </h1>

      {/* Month Selector + Search + Bulk Add */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg shadow px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
          >
            &larr; Prev
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
          >
            Next &rarr;
          </button>
        </div>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <button
              onClick={openBulkAdd}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 5v14m-7-7h14" /></svg>
              Bulk Add Shifts
            </button>
          )}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by employee name..."
            className="w-full sm:w-64 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pl-9 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Employee Sidebar */}
          <div className="hidden lg:block w-56 shrink-0">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                Employees with Shifts
              </h2>
              {employeesWithShifts.length === 0 ? (
                <p className="text-sm text-gray-400">No shifts this month</p>
              ) : (
                <ul className="space-y-1.5">
                  {employeesWithShifts.map((e) => (
                    <li key={e.id} className="text-sm text-gray-700 truncate">
                      {e.name}
                    </li>
                  ))}
                </ul>
              )}

              {/* Legend */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</h3>
                <div className="space-y-1">
                  {SHIFT_TYPES.map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-sm border ${SHIFT_TYPE_COLORS[type]}`} />
                      <span className="text-xs text-gray-600">{SHIFT_TYPE_LABELS[type]}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm border bg-red-100 border-red-300" />
                    <span className="text-xs text-gray-600">On Leave</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b">
              {DAYS.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar body */}
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r bg-gray-50" />;
                }

                const { day, dateStr } = cell;
                const dayShifts = shiftsByDate[dateStr] ?? [];
                const hasLeave = datesWithLeave.has(dateStr);
                const isToday = dateStr === toDateString(today);

                // Count how many users have leave on this date
                const usersOnLeaveToday = Object.keys(leaveByUser).filter(
                  (uid) => leaveByUser[uid]?.has(dateStr)
                );
                const allOnLeave = usersOnLeaveToday.length > 0 && usersOnLeaveToday.length >= users.length;

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[100px] border-b border-r p-1 transition ${
                      allOnLeave
                        ? "bg-red-50/60 cursor-not-allowed"
                        : readOnly
                          ? ""
                          : "cursor-pointer hover:bg-blue-50/50"
                    } ${isToday ? "bg-blue-50" : ""}`}
                    onClick={() => !readOnly && !allOnLeave && openBulkAdd()}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isToday
                            ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                            : allOnLeave
                              ? "text-gray-400"
                              : "text-gray-600"
                        }`}
                      >
                        {day}
                      </span>
                      {hasLeave && (
                        <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                          allOnLeave
                            ? "bg-red-200 text-red-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {usersOnLeaveToday.length} on leave
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {dayShifts.slice(0, 3).map((shift) => {
                        const shiftUserOnLeave = userHasLeave(shift.user.id, dateStr);
                        return (
                          <div
                            key={shift.id}
                            className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${readOnly ? "" : "cursor-pointer"} ${
                              shiftUserOnLeave
                                ? "bg-red-50 text-red-400 border-red-200 line-through"
                                : SHIFT_TYPE_COLORS[shift.type]
                            }`}
                            title={`${shift.user.name} - ${SHIFT_TYPE_LABELS[shift.type]}${shiftUserOnLeave ? " (ON LEAVE)" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!readOnly) openEditModal(shift);
                            }}
                          >
                            {shift.user.name.split(" ")[0]} - {SHIFT_TYPE_LABELS[shift.type]}
                          </div>
                        );
                      })}
                      {dayShifts.length > 3 && (
                        <div className="text-[10px] text-gray-500 pl-1">+{dayShifts.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {!readOnly && modalOpen && editingShift && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Edit Shift</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select value={formUserId} onChange={(e) => setFormUserId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select employee...</option>
                  {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                </select>
              </div>
              {selectedUserOnLeave && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  This employee has approved leave on this date.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as ShiftType)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SHIFT_TYPES.map((type) => (<option key={type} value={type}>{SHIFT_TYPE_LABELS[type]}</option>))}
                </select>
              </div>
              {formType === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={handleDelete} disabled={submitting} className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50">Delete</button>
              <div className="flex gap-2">
                <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || !formUserId || selectedUserOnLeave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? "Saving..." : "Update Shift"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Shifts Panel */}
      {!readOnly && bulkOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-2xl">
              <button onClick={() => setBulkOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bulk Add Shifts</h2>
                <p className="text-xs text-gray-500 mt-0.5">Create multiple shifts at once</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Employee Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                <select
                  value={bulkUserId}
                  onChange={(e) => setBulkUserId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition"
                >
                  <option value="">Select employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>

              {/* Shift Times */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shift Times</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={bulkStartTime}
                      onChange={(e) => setBulkStartTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={bulkEndTime}
                      onChange={(e) => setBulkEndTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Mode Toggle: Pattern vs Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Days By</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-300">
                  <button
                    onClick={() => setBulkMode("pattern")}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                      bulkMode === "pattern"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Weekly Pattern
                  </button>
                  <button
                    onClick={() => setBulkMode("dates")}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                      bulkMode === "dates"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Pick Dates
                  </button>
                </div>
              </div>

              {/* Weekly Pattern Mode */}
              {bulkMode === "pattern" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Repeat On</label>
                  <div className="flex gap-2 justify-center">
                    {["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const next = [...bulkDays];
                          next[idx] = !next[idx];
                          setBulkDays(next);
                        }}
                        className={`w-11 h-11 rounded-full text-sm font-semibold transition-all ${
                          bulkDays[idx]
                            ? "bg-gray-900 text-white shadow-lg shadow-gray-400/30"
                            : "bg-gray-100 text-gray-400 border border-gray-300 hover:border-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Single Calendar with month/year navigation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {bulkMode === "dates" ? "Click dates to select / deselect" : "Calendar preview"}
                </label>
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  {/* Calendar Navigation Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={bulkCalendarPrev}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-800">
                      {new Date(bulkCalendar.year, bulkCalendar.month - 1).toLocaleString("default", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      onClick={bulkCalendarNext}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-gray-100">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-500 uppercase">{d}</div>
                    ))}
                  </div>

                  {/* Date cells */}
                  <div className="grid grid-cols-7 gap-1 p-2">
                    {/* Empty leading cells */}
                    {Array.from({ length: bulkCalendar.firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-10" />
                    ))}
                    {bulkCalendar.allDates.map(({ day, dateStr, isLeave }) => {
                      const isSelected = bulkSelectedDatesSet.has(dateStr);
                      const isCustomSelected = bulkCustomDates.has(dateStr);
                      const clickable = bulkMode === "dates" && !isLeave;

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={isLeave || bulkMode === "pattern"}
                          onClick={() => clickable && toggleBulkDate(dateStr)}
                          className={`h-10 w-full rounded-lg text-sm font-medium transition-all ${
                            isLeave
                              ? "bg-red-50 text-red-300 cursor-not-allowed line-through"
                              : bulkMode === "dates"
                                ? isCustomSelected
                                  ? "bg-gray-900 text-white shadow-sm"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                                : isSelected
                                  ? "bg-gray-800 text-white shadow-sm"
                                  : "text-gray-400"
                          }`}
                          title={isLeave ? "On approved leave" : dateStr}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend + selected count */}
                  <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-gray-800" />
                        <span className="text-[10px] text-gray-600">Selected</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-200" />
                        <span className="text-[10px] text-red-500">On leave</span>
                      </div>
                    </div>
                    {bulkSummary.count > 0 && (
                      <span className="text-[10px] font-medium text-gray-500">{bulkSummary.count} day{bulkSummary.count !== 1 ? "s" : ""} selected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Include Break */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    bulkIncludeBreak ? "bg-gray-900" : "bg-gray-300"
                  }`}
                  onClick={() => setBulkIncludeBreak(!bulkIncludeBreak)}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      bulkIncludeBreak ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </div>
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">
                  Include 1-hour unpaid break
                </span>
              </label>

              {/* Summary */}
              {bulkUserId && bulkSummary.count > 0 && (
                <div className="rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-gray-200 p-1.5">
                      <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">
                        This will generate <span className="font-bold text-gray-900">{bulkSummary.count} shifts</span> for{" "}
                        {new Date(Number(bulkMonth.split("-")[0]), Number(bulkMonth.split("-")[1]) - 1).toLocaleString("default", { month: "long", year: "numeric" })}.
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Total scheduled hours: <span className="font-bold text-gray-900">{bulkSummary.totalHours.toFixed(1)}h</span>
                        {bulkIncludeBreak && <span className="text-gray-400 text-xs ml-1">(after break deduction)</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {bulkUserId && bulkSummary.count === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm text-amber-700">No shifts to generate. {bulkMode === "dates" ? "Click on dates in the calendar above." : "Check selected days and leave conflicts."}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/30 rounded-b-2xl flex items-center justify-between">
              <button
                onClick={() => setBulkOpen(false)}
                className="text-sm text-gray-400 hover:text-gray-700 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSubmit}
                disabled={bulkSubmitting || !bulkUserId || bulkSummary.count === 0}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl transition shadow-lg shadow-gray-300/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
              >
                {bulkSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7" /></svg>
                    Generate &amp; Save Shifts
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
