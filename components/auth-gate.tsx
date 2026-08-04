"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./app-provider";

export function AuthGate({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { session, profile, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login");
    else if (admin && !profile?.is_admin) router.replace("/");
  }, [session, profile, loading, admin, router]);

  if (loading || !session || (admin && !profile?.is_admin)) {
    return <main className="center-screen"><div className="spinner" /><p>Lädt …</p></main>;
  }
  return <>{children}</>;
}
