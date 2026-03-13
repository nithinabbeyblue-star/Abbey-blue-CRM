import { getCurrentUser } from "@/lib/auth";
import { DeadlineEngine } from "@/components/cases/deadline-engine";

export default async function AdminDeadlinesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Deadline Engine</h1>
        <p className="mt-1 text-sm text-muted">
          Track upcoming deadlines for your assigned cases
        </p>
      </div>
      <DeadlineEngine basePath="/admin" userRole={user.role} />
    </div>
  );
}
