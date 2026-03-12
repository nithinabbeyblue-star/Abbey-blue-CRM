import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

const BUFFER_MINUTES = 15;

const bookingSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// GET /api/bookings — List bookings for a month
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month

  const bookings = await db.roomBooking.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ bookings });
}

// POST /api/bookings — Create a booking with conflict + buffer validation
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = bookingSchema.parse(body);

    const startMins = timeToMinutes(data.startTime);
    const endMins = timeToMinutes(data.endTime);

    if (endMins <= startMins) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    if (endMins - startMins < 15) {
      return NextResponse.json(
        { error: "Booking must be at least 15 minutes" },
        { status: 400 }
      );
    }

    // Check for conflicts (including 15-min buffer)
    const bookingDate = new Date(data.date + "T00:00:00Z");
    const existing = await db.roomBooking.findMany({
      where: { date: bookingDate },
      select: { startTime: true, endTime: true, title: true, user: { select: { name: true } } },
    });

    const bufferedStart = startMins - BUFFER_MINUTES;
    const bufferedEnd = endMins + BUFFER_MINUTES;

    for (const b of existing) {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      // Check overlap: new booking's buffered range overlaps with existing booking's range
      if (bufferedStart < bEnd && bufferedEnd > bStart) {
        return NextResponse.json(
          {
            error: `Conflicts with "${b.title}" (${b.startTime}–${b.endTime}) by ${b.user.name}. A 15-minute buffer is required between meetings.`,
          },
          { status: 409 }
        );
      }
    }

    const booking = await db.roomBooking.create({
      data: {
        title: data.title,
        date: bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
        userId: user.userId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Send confirmation email (non-blocking)
    sendMail({
      to: user.email,
      subject: `Meeting Booked: ${data.title}`,
      html: `
        <h2>Meeting Room Booking Confirmed</h2>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:4px 12px;font-weight:bold;">Title</td><td>${data.title}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Date</td><td>${data.date}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Time</td><td>${data.startTime} – ${data.endTime}</td></tr>
          ${data.notes ? `<tr><td style="padding:4px 12px;font-weight:bold;">Notes</td><td>${data.notes}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;color:#666;">A 15-minute cleanup buffer has been reserved after your meeting.</p>
      `,
    }).catch((err) => console.error("Booking email error:", err));

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Create booking error:", err);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
