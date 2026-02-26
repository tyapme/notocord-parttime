"use client";

import { AppShell } from "@/components/app-shell";
import { AdminScreen } from "./admin-management-page";

export default function Page() {
  return (
    <AppShell tab="admin">
      <AdminScreen />
    </AppShell>
  );
}
