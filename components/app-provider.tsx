"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PushBootstrap } from "./push-settings";

type AppContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);
    if (!currentSession) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", currentSession.user.id).single();
    setProfile(data ?? null);
  };

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshProfile().finally(() => setLoading(false));
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.error);
    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AppContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
      <PushBootstrap />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
