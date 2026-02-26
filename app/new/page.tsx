"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewRequestScreen } from "./new-request-page";

export default function Page() {
  const router = useRouter();
  return (
    <AppShell tab="new">
      <NewRequestScreen onSuccess={() => router.push("/shift/my")} />
    </AppShell>
  );
}
