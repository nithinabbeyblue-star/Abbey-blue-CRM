import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
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
    { label: "New Ticket", href: "/sales/tickets/new", icon: "\u{2795}" },
    { label: "My Cases", href: "/sales/my-cases", icon: "\u{1F4CB}" },
    ...(isManager
      ? [
          { label: "Team Cases", href: "/sales/tickets", icon: "\u{1F4C2}" },
          { label: "Team Progress", href: "/sales/team", icon: "\u{1F4CA}" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <Sidebar navItems={salesNav} userName={user.name} userRole={user.role} userId={user.userId} />
      <main className="ml-64 min-h-screen bg-background p-8">
        {children}
      </main>
    </div>
  );
}
