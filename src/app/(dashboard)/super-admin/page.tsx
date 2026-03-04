import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
import { SuperAdminDashboardContent } from "./dashboard-content";

export default async function SuperAdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Super Admin Dashboard — System overview and analytics
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/super-admin/users"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50"
          >
            Manage Users
          </Link>
          <Link
            href="/super-admin/finance"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Finance
          </Link>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <SuperAdminDashboardContent />
      </Suspense>
    </div>
  );
}
