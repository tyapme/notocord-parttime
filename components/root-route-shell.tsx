"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { Tab } from "@/components/app-nav";

function resolveTab(pathname: string): Tab | null {
  if (pathname === "/home") return "home";
  if (pathname === "/attendance") return "attendance-home";
  if (pathname === "/attendance/list") return "attendance-list";
  if (pathname === "/attendance/manage") return "attendance-manage";
  if (pathname === "/shift" || pathname === "/shifts") return "shifts";
  if (pathname === "/my" || pathname === "/shift/my") return "my";
  if (pathname === "/new" || pathname === "/shift/new") return "new";
  if (pathname === "/review" || pathname === "/shift/review") return "review";
  if (pathname === "/proxy" || pathname === "/shift/proxy") return "proxy";
  if (pathname === "/users") return "users";
  if (pathname === "/admin") return "admin";
  return null;
}

export function RootRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tab = resolveTab(pathname);

  if (!tab) return <>{children}</>;
  return <AppShell tab={tab}>{children}</AppShell>;
}
