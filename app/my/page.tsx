"use client";

import { useRouter } from "next/navigation";
import { MyRequestsScreen } from "./my-requests-page";

export default function Page() {
  const router = useRouter();
  return <MyRequestsScreen onNewRequest={() => router.push("/shift/new")} />;
}
