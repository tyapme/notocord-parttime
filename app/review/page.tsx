"use client";

import { AppShell } from "@/components/app-shell";
import { ReviewScreen } from "./review-requests-page";

export default function Page() {
  return (
    <AppShell tab="review">
      <ReviewScreen />
    </AppShell>
  );
}
