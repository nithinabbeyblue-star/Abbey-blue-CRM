"use client";

import { MyCasesPage } from "@/components/cases/my-cases-page";

export default function SuperAdminMyCases() {
  return <MyCasesPage basePath="/super-admin/tickets" roleLabel="All cases overview" />;
}
