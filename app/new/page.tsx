"use client";

import { useRouter } from "next/navigation";
import { NewRequestScreen } from "./new-request-page";

export default function Page() {
  const router = useRouter();
  return <NewRequestScreen onSuccess={() => router.push("/shift/my", { scroll: false })} />;
}
