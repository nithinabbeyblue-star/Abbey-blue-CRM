"use client";

import { MyCasesPage } from "@/components/cases/my-cases-page";

export default function AdminMyCases() {
  return <MyCasesPage basePath="/admin/tickets" roleLabel="Your assigned cases" />;
}
