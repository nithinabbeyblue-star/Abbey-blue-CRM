import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BookingCalendar } from "@/components/booking/booking-calendar";

export default async function SalesBookingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <BookingCalendar currentUserId={user.userId} userRole={user.role} />;
}
