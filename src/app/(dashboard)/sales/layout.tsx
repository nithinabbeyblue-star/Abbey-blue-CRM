import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";
import { HRLayoutWrapper, HRMainContent } from "@/components/hr/hr-layout-wrapper";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?reason=session_invalid");
  if (
    user.role !== "SALES" &&
    user.role !== "SALES_MANAGER" &&
    user.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }

  const isManager = user.role === "SALES_MANAGER" || user.role === "SUPER_ADMIN";

  const salesNav = [
    { label: "Dashboard", href: "/sales", icon: "\u{1F3E0}" },
    { label: "New Case", href: "/sales/tickets/new", icon: "\u{2795}" },
    { label: "My Cases", href: "/sales/my-cases", icon: "\u{1F4CB}" },
    { label: "Payment Follow-up", href: "/sales/payment-followup", icon: "\u{1F4B3}" },
    ...(isManager
      ? [
          { label: "Team Cases", href: "/sales/tickets", icon: "\u{1F4C2}" },
          { label: "Team Progress", href: "/sales/team", icon: "\u{1F4CA}" },
        ]
      : []),
    { label: "Case Board", href: "/sales/case-board", icon: "\u{2705}" },
    { label: "Deadlines", href: "/sales/deadlines", icon: "\u{23F0}" },
    { label: "Book Meeting", href: "/sales/booking", icon: "\u{1F4C5}" },
  ];

  return (
    <HRLayoutWrapper>
      <div className="min-h-screen">
        <Sidebar navItems={salesNav} userName={user.name} userRole={user.role} userId={user.userId} />
        <main className="min-h-screen bg-background p-4 pt-16 sm:p-6 sm:pt-16 lg:ml-64 lg:p-8 lg:pt-8">
          <HRMainContent>{children}</HRMainContent>
        </main>
      </div>
    </HRLayoutWrapper>
  );
}
