"use client";

import { NewTicketForm } from "@/components/tickets/new-ticket-form";

export default function SuperAdminNewTicketPage() {
  return <NewTicketForm basePath="/super-admin/tickets" />;
}
