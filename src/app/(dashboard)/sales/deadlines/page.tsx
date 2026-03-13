import { getCurrentUser } from "@/lib/auth";
import { DeadlineEngine } from "@/components/cases/deadline-engine";

export default async function SalesDeadlinesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Deadline Engine</h1>
        <p className="mt-1 text-sm text-muted">
          Track your cases with upcoming deadlines and send reminders
        </p>
      </div>
      <DeadlineEngine basePath="/sales" userRole={user.role} />
    </div>
  );
}
