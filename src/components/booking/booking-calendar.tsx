"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDateISO } from "@/lib/date-utils";

interface BookingUser {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  userId: string;
  user: BookingUser;
}

interface BookingModalData {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am to 7pm

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}


const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function BookingCalendar({ currentUserId, userRole }: { currentUserId: string; userRole: string }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<BookingModalData>({
    date: "",
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings?month=${month + 1}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function openBookingModal(dateStr: string) {
    setModalData({
      date: dateStr,
      title: "",
      startTime: "09:00",
      endTime: "10:00",
      notes: "",
    });
    setMessage({ text: "", type: "" });
    setShowModal(true);
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  }

  async function handleCreateBooking() {
    if (!modalData.title.trim()) {
      setMessage({ text: "Please enter a meeting title", type: "error" });
      return;
    }

    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalData),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || "Failed to create booking", type: "error" });
        return;
      }

      setMessage({ text: "Meeting booked successfully!", type: "success" });
      setShowModal(false);
      setSelectedDate(modalData.date);
      await fetchBookings();
    } catch {
      setMessage({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookingId: string) {
    if (!confirm("Cancel this booking?")) return;

    setDeleting(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel booking");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeleting(null);
    }
  }

  // Build calendar grid
  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = (days[0].getDay() + 6) % 7; // Mon=0
  const todayStr = formatDateISO(today);

  // Group bookings by date
  const bookingsByDate: Record<string, Booking[]> = {};
  for (const b of bookings) {
    const d = b.date.split("T")[0];
    if (!bookingsByDate[d]) bookingsByDate[d] = [];
    bookingsByDate[d].push(b);
  }

  // Day bookings for selected date
  const selectedBookings = selectedDate ? bookingsByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meeting Room</h1>
          <p className="text-sm text-muted">Book the meeting room and manage your reservations</p>
        </div>
      </div>

      {/* Success/Error messages outside modal */}
      {!showModal && message.text && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {/* Month nav */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                &larr; Prev
              </button>
              <h2 className="text-lg font-semibold text-foreground">
                {MONTH_NAMES[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Next &rarr;
              </button>
            </div>

            {/* Day headers */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 rounded-lg bg-gray-50/50" />
              ))}

              {days.map((day) => {
                const dateStr = formatDateISO(day);
                const dayBookings = bookingsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const isPast = dateStr < todayStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDayClick(dateStr)}
                    className={`relative h-20 rounded-lg border p-1.5 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : isToday
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-gray-50"
                    } ${isPast ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-primary text-white"
                          : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {/* Booking dots */}
                    <div className="mt-0.5 space-y-0.5">
                      {dayBookings.slice(0, 2).map((b) => (
                        <div
                          key={b.id}
                          className={`truncate rounded px-1 text-[10px] leading-tight ${
                            b.userId === currentUserId
                              ? "bg-primary/20 text-primary"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {b.startTime} {b.title}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <div className="px-1 text-[10px] text-muted">
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {loading && (
              <p className="mt-4 text-center text-xs text-muted">Loading bookings...</p>
            )}
          </div>
        </div>

        {/* Side panel — day detail */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {selectedDate ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h3>
                  {selectedDate >= todayStr && (
                    <button
                      onClick={() => openBookingModal(selectedDate)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                    >
                      + Book
                    </button>
                  )}
                </div>

                {selectedBookings.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    No bookings for this day.
                    {selectedDate >= todayStr && " Click + Book to reserve the room."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Timeline */}
                    {HOURS.map((hour) => {
                      const hourStr = String(hour).padStart(2, "0");
                      const hourBookings = selectedBookings.filter((b) => {
                        const startH = parseInt(b.startTime.split(":")[0]);
                        return startH === hour;
                      });

                      if (hourBookings.length === 0 ) return null;

                      return (
                        <div key={hour}>
                          {hourBookings.map((b) => (
                            <div
                              key={b.id}
                              className={`rounded-lg border p-3 ${
                                b.userId === currentUserId
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-orange-200 bg-orange-50"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {b.title}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {b.startTime} – {b.endTime}
                                  </p>
                                  <p className="mt-1 text-xs text-muted">
                                    {b.user.name}
                                  </p>
                                  {b.notes && (
                                    <p className="mt-1 text-xs text-muted italic">
                                      {b.notes}
                                    </p>
                                  )}
                                </div>
                                {(b.userId === currentUserId || userRole === "SUPER_ADMIN") && (
                                  <button
                                    onClick={() => handleDelete(b.id)}
                                    disabled={deleting === b.id}
                                    className="ml-2 rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {deleting === b.id ? "..." : "Cancel"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {/* Bookings outside 7-19 range */}
                    {selectedBookings
                      .filter((b) => {
                        const h = parseInt(b.startTime.split(":")[0]);
                        return h < 7 || h > 19;
                      })
                      .map((b) => (
                        <div
                          key={b.id}
                          className={`rounded-lg border p-3 ${
                            b.userId === currentUserId
                              ? "border-primary/30 bg-primary/5"
                              : "border-orange-200 bg-orange-50"
                          }`}
                        >
                          <p className="text-sm font-medium">{b.title}</p>
                          <p className="text-xs text-muted">
                            {b.startTime} – {b.endTime} &bull; {b.user.name}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Legend */}
                <div className="mt-6 flex items-center gap-4 border-t border-border pt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded bg-primary/20" />
                    <span className="text-[11px] text-muted">Your bookings</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded bg-orange-100" />
                    <span className="text-[11px] text-muted">Others</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-3xl">&#x1F4C5;</p>
                <p className="mt-2 text-sm text-muted">
                  Select a day to view bookings or make a reservation
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Book Meeting Room
            </h3>
            <p className="mb-4 text-sm text-muted">
              {new Date(modalData.date + "T12:00:00").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={modalData.title}
                  onChange={(e) =>
                    setModalData({ ...modalData, title: e.target.value })
                  }
                  placeholder="e.g. Client consultation"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={modalData.startTime}
                    onChange={(e) =>
                      setModalData({ ...modalData, startTime: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={modalData.endTime}
                    onChange={(e) =>
                      setModalData({ ...modalData, endTime: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Notes (optional)
                </label>
                <textarea
                  value={modalData.notes}
                  onChange={(e) =>
                    setModalData({ ...modalData, notes: e.target.value })
                  }
                  placeholder="Any additional details..."
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <p className="text-[11px] text-muted">
                A 15-minute cleanup buffer is automatically added after your meeting.
              </p>

              {/* Modal error */}
              {message.text && message.type === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {message.text}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setMessage({ text: "", type: "" });
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? "Booking..." : "Book Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
