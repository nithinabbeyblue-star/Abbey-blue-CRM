import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
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
          { label: "Assignments", href: "/admin/assignments", icon: "\u{1F465}" },
          { label: "Team Progress", href: "/admin/team", icon: "\u{1F4CA}" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <Sidebar navItems={adminNav} userName={user.name} userRole={user.role} userId={user.userId} />
      <main className="ml-64 min-h-screen bg-background p-8">
        {children}
      </main>
    </div>
  );
}
