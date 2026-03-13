import { getCurrentUser } from "@/lib/auth";
import { CaseStatusBoard } from "@/components/cases/case-status-board";

export default async function SalesCaseBoardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Case Status Board</h1>
        <p className="mt-1 text-sm text-muted">
          Your approved and rejected cases
        </p>
      </div>
      <CaseStatusBoard basePath="/sales" />
    </div>
  );
}
