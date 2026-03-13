import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";
import { HRLayoutWrapper, HRMainContent } from "@/components/hr/hr-layout-wrapper";

const superAdminNav = [
  { label: "Dashboard", href: "/super-admin", icon: "\u{1F4CA}" },
  { label: "New Case", href: "/super-admin/tickets/new", icon: "\u{2795}" },
  { label: "Assignments", href: "/super-admin/assignments", icon: "\u{1F4E5}" },
  { label: "My Cases", href: "/super-admin/my-cases", icon: "\u{1F4CB}" },
  { label: "All Cases", href: "/super-admin/tickets", icon: "\u{1F4C2}" },
  { label: "Users", href: "/super-admin/users", icon: "\u{1F465}" },
  { label: "Finance", href: "/super-admin/finance", icon: "\u{1F4B0}" },
  { label: "Payment Follow-up", href: "/super-admin/payment-followup", icon: "\u{1F4B3}" },
  { label: "Case Board", href: "/super-admin/case-board", icon: "\u{2705}" },
  { label: "Audit Logs", href: "/super-admin/audit-logs", icon: "\u{1F50D}" },
  { label: "Book Meeting", href: "/super-admin/booking", icon: "\u{1F4C5}" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?reason=session_invalid");
  if (user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <HRLayoutWrapper>
      <div className="min-h-screen">
        <Sidebar
          navItems={superAdminNav}
          userName={user.name}
          userRole={user.role}
          userId={user.userId}
        />
        <main className="min-h-screen bg-background p-4 pt-16 sm:p-6 sm:pt-16 lg:ml-64 lg:p-8 lg:pt-8">
          <HRMainContent>{children}</HRMainContent>
        </main>
      </div>
    </HRLayoutWrapper>
  );
}
