import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardPath } from "@/lib/rbac";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?reason=session_invalid");
  }

  redirect(getDashboardPath(user.role));
}
