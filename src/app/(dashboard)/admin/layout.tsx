import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";
import { HRLayoutWrapper, HRMainContent } from "@/components/hr/hr-layout-wrapper";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?reason=session_invalid");
  if (
    user.role !== "ADMIN" &&
    user.role !== "ADMIN_MANAGER" &&
    user.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }

  const isManager = user.role === "ADMIN_MANAGER" || user.role === "SUPER_ADMIN";

  const adminNav = [
    { label: "Dashboard", href: "/admin", icon: "\u{1F3E0}" },
    { label: "My Cases", href: "/admin/my-cases", icon: "\u{1F4CB}" },
    ...(isManager
      ? [
          { label: "Team Cases", href: "/admin/tickets", icon: "\u{1F4C2}" },
          { label: "Assignments", href: "/admin/assignments", icon: "\u{1F465}" },
          { label: "Team Progress", href: "/admin/team", icon: "\u{1F4CA}" },
        ]
      : []),
  ];

  return (
    <HRLayoutWrapper>
      <div className="min-h-screen">
        <Sidebar navItems={adminNav} userName={user.name} userRole={user.role} userId={user.userId} />
        <main className="min-h-screen bg-background p-4 pt-16 sm:p-6 sm:pt-16 lg:ml-64 lg:p-8 lg:pt-8">
          <HRMainContent>{children}</HRMainContent>
        </main>
      </div>
    </HRLayoutWrapper>
  );
}
