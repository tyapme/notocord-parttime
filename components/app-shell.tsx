"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppNav, Tab } from "./app-nav";
import { LoginScreen } from "./login-screen";

const PATH_BY_TAB: Record<Tab, string> = {
  home: "/home",
  attendance: "/attendance",
  shifts: "/shift",
  my: "/shift/my",
  new: "/shift/new",
  review: "/shift/review",
  proxy: "/shift/proxy",
  users: "/users",
  admin: "/admin",
};

function defaultTab(): Tab {
  return "home";
}

function allowedTabs(role: string): Tab[] {
  if (role === "staff") return ["home", "attendance", "shifts", "my", "new"];
  if (role === "reviewer") return ["home", "attendance", "shifts", "review", "proxy", "users"];
  return ["home", "attendance", "shifts", "review", "proxy", "users", "admin"];
}

function isAllowed(role: string, tab: Tab): boolean {
  return allowedTabs(role).includes(tab);
}

export function AppShell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const currentUser = useAppStore((s) => s.currentUser);
  const init = useAppStore((s) => s.init);
  const authLoading = useAppStore((s) => s.authLoading);
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  const navigate = useCallback(
    (nextTab: Tab) => {
      const nextPath = PATH_BY_TAB[nextTab];
      router.push(nextPath, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (!currentUser) return;
    for (const nextTab of allowedTabs(currentUser.role)) {
      void router.prefetch(PATH_BY_TAB[nextTab]);
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isAllowed(currentUser.role, tab)) {
      const next = PATH_BY_TAB[defaultTab()];
      router.replace(next, { scroll: false });
    }
  }, [currentUser, tab, router]);

  if (authLoading && !currentUser) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (!isAllowed(currentUser.role, tab)) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  return (
    <div className="min-h-screen">
      <AppNav
        activeTab={tab}
        onTabChange={navigate}
      />
      <main className="app-shell-main">
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
