"use client";

import { MyHRPage } from "@/components/hr/my-hr-page";
import { useEffect, useState } from "react";

export default function AdminHRPage() {
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setRole(d.user?.role || "ADMIN");
        setUserId(d.user?.userId || "");
      })
      .catch(() => setRole("ADMIN"));
  }, []);

  if (!role || !userId) return <div className="flex h-64 items-center justify-center text-muted">Loading...</div>;

  return <MyHRPage userRole={role} userId={userId} />;
}
