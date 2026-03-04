import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";

const superAdminNav = [
  { label: "Dashboard", href: "/super-admin", icon: "\u{1F4CA}" },
  { label: "My Cases", href: "/super-admin/my-cases", icon: "\u{1F4CB}" },
  { label: "Users", href: "/super-admin/users", icon: "\u{1F465}" },
  { label: "Finance", href: "/super-admin/finance", icon: "\u{1F4B0}" },
  { label: "Audit Logs", href: "/super-admin/audit-logs", icon: "\u{1F50D}" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        navItems={superAdminNav}
        userName={user.name}
        userRole={user.role}
        userId={user.userId}
      />
      <main className="ml-64 min-h-screen bg-background p-8">
        {children}
      </main>
    </div>
  );
}
