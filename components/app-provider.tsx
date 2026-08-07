"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PushBootstrap } from "./push-settings";
import { DeviceHealthReporter } from "./device-health-reporter";
import { TourBurn } from "./tour-burn";
import { TourBurnHomePortal } from "./tour-burn-home-portal";
import { AdminTourBurnPortal } from "./admin-tour-burn-portal";

const ADMIN_PREVIEW_KEY="firestarter-admin-participant-preview";

type AppContextValue = {session:Session|null;profile:Profile|null;loading:boolean;refreshProfile:()=>Promise<void>;actualIsAdmin:boolean;adminPreview:boolean;setAdminPreview:(enabled:boolean)=>void};
const AppContext=createContext<AppContextValue|undefined>(undefined);

export function AppProvider({children}:{children:React.ReactNode}){
 const supabase=useMemo(()=>createClient(),[]);const[session,setSession]=useState<Session|null>(null);const[actualProfile,setActualProfile]=useState<Profile|null>(null);const[loading,setLoading]=useState(true);const[adminPreview,setAdminPreviewState]=useState(false);const[tourBurned,setTourBurned]=useState(false);const[localBurnAnimation,setLocalBurnAnimation]=useState(false);
 const loadBurnStatus=useCallback(async(currentSession:Session|null)=>{if(!currentSession){setTourBurned(false);return}try{const r=await fetch("/api/tour-burn",{headers:{Authorization:`Bearer ${currentSession.access_token}`},cache:"no-store"});const j=await r.json();setTourBurned(r.ok&&Boolean(j.burned))}catch{}},[]);
 const refreshProfile=async()=>{const{data:{session:currentSession}}=await supabase.auth.getSession();setSession(currentSession);if(!currentSession){setActualProfile(null);setAdminPreviewState(false);setTourBurned(false);return}const{data}=await supabase.from("profiles").select("*").eq("id",currentSession.user.id).single();setActualProfile(data??null);await loadBurnStatus(currentSession)};
 useEffect(()=>{try{setAdminPreviewState(localStorage.getItem(ADMIN_PREVIEW_KEY)==="1")}catch{}},[]);
 useEffect(()=>{refreshProfile().finally(()=>setLoading(false));const{data:{subscription}}=supabase.auth.onAuthStateChange(()=>refreshProfile().finally(()=>setLoading(false)));if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(console.error);return()=>subscription.unsubscribe()},[supabase]);
 useEffect(()=>{const start=()=>setLocalBurnAnimation(true);const end=()=>setLocalBurnAnimation(false);const status=()=>void loadBurnStatus(session);window.addEventListener("tour-burn-animation-start",start);window.addEventListener("tour-burn-animation-end",end);window.addEventListener("tour-burn-status-change",status);return()=>{window.removeEventListener("tour-burn-animation-start",start);window.removeEventListener("tour-burn-animation-end",end);window.removeEventListener("tour-burn-status-change",status)}},[loadBurnStatus,session]);
 useEffect(()=>{
  const userId=session?.user.id;if(!userId)return;
  const channel=supabase.channel(`app-provider-live:${userId}`)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${userId}`},payload=>{setActualProfile(payload.new as Profile)})
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},()=>void loadBurnStatus(session))
   .subscribe();
  const sync=()=>{if(document.visibilityState==="visible")void refreshProfile()};
  document.addEventListener("visibilitychange",sync);window.addEventListener("focus",sync);
  return()=>{document.removeEventListener("visibilitychange",sync);window.removeEventListener("focus",sync);void supabase.removeChannel(channel)};
 },[session?.user.id,supabase,loadBurnStatus]);
 const actualIsAdmin=Boolean(actualProfile?.is_admin);useEffect(()=>{if(actualProfile&&!actualIsAdmin)setAdminPreviewState(false)},[actualProfile,actualIsAdmin]);
 const setAdminPreview=(enabled:boolean)=>{if(enabled&&!actualIsAdmin)return;setAdminPreviewState(enabled);try{if(enabled)localStorage.setItem(ADMIN_PREVIEW_KEY,"1");else localStorage.removeItem(ADMIN_PREVIEW_KEY)}catch{}};
 const effectivePreview=adminPreview&&actualIsAdmin;
 const profile=useMemo(()=>{if(!actualProfile)return null;if(!effectivePreview)return actualProfile;return{...actualProfile,is_admin:false}as Profile},[actualProfile,effectivePreview]);
 const locked=tourBurned&&Boolean(session)&&!localBurnAnimation&&!actualIsAdmin;
 const contextValue={session,profile,loading,refreshProfile,actualIsAdmin,adminPreview:effectivePreview,setAdminPreview};

 // A burned participant gets no application tree at all. This is deliberately
 // account-based: reinstalling, changing devices or logging in again still
 // resolves the server-side burn flag before normal app use is restored.
 if(locked){
  return <AppContext.Provider value={contextValue}><TourBurn mode="final"/></AppContext.Provider>;
 }

 return <AppContext.Provider value={contextValue}>{children}<PushBootstrap/><DeviceHealthReporter/><TourBurnHomePortal/><AdminTourBurnPortal/></AppContext.Provider>
}
export function useApp(){const ctx=useContext(AppContext);if(!ctx)throw new Error("useApp must be used inside AppProvider");return ctx}
