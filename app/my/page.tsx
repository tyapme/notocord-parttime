"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MyRequestsScreen } from "./my-requests-page";

export default function Page() {
  const router = useRouter();
  return (
    <AppShell tab="my">
      <MyRequestsScreen onNewRequest={() => router.push("/shift/new")} />
    </AppShell>
  );
}
