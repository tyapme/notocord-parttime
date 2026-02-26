"use client";

import { AppShell } from "@/components/app-shell";
import { UsersDetailScreen } from "./user-detail-page";

export default function Page() {
  return (
    <AppShell tab="users">
      <UsersDetailScreen />
    </AppShell>
  );
}
