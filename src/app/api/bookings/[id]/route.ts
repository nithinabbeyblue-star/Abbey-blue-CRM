import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/bookings/[id] — Cancel a booking (own bookings or SUPER_ADMIN/managers)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const booking = await db.roomBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Only allow cancellation by booking owner or super admin
  const canDelete =
    booking.userId === user.userId ||
    user.role === "SUPER_ADMIN";

  if (!canDelete) {
    return NextResponse.json(
      { error: "You can only cancel your own bookings" },
      { status: 403 }
    );
  }

  await db.roomBooking.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
