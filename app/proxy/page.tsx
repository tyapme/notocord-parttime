"use client";

import { AppShell } from "@/components/app-shell";
import { ProxyCreateScreen } from "./proxy-create-page";

export default function Page() {
  return (
    <AppShell tab="proxy">
      <ProxyCreateScreen />
    </AppShell>
  );
}
