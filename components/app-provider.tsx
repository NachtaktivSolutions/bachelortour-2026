"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PushBootstrap } from "./push-settings";
import { DeviceHealthReporter } from "./device-health-reporter";
import { TourBurn } from "./tour-burn";
import { TourBurnHomePortal } from "./tour-burn-home-portal";

const ADMIN_PREVIEW_KEY="firestarter-admin-participant-preview";

type AppContextValue = {session:Session|null;profile:Profile|null;loading:boolean;refreshProfile:()=>Promise<void>;actualIsAdmin:boolean;adminPreview:boolean;setAdminPreview:(enabled:boolean)=>void};
const AppContext=createContext<AppContextValue|undefined>(undefined);

export function AppProvider({children}:{children:React.ReactNode}){
 const supabase=useMemo(()=>createClient(),[]);const[session,setSession]=useState<Session|null>(null);const[actualProfile,setActualProfile]=useState<Profile|null>(null);const[loading,setLoading]=useState(true);const[adminPreview,setAdminPreviewState]=useState(false);const[tourBurned,setTourBurned]=useState(false);const[localBurnAnimation,setLocalBurnAnimation]=useState(false);
 const refreshProfile=async()=>{const{data:{session:currentSession}}=await supabase.auth.getSession();setSession(currentSession);if(!currentSession){setActualProfile(null);setAdminPreviewState(false);setTourBurned(false);return}const[{data},{data:settings}]=await Promise.all([supabase.from("profiles").select("*").eq("id",currentSession.user.id).single(),supabase.from("app_settings").select("tour_burned").eq("id",1).maybeSingle()]);setActualProfile(data??null);setTourBurned(Boolean(settings?.tour_burned))};
 useEffect(()=>{try{setAdminPreviewState(localStorage.getItem(ADMIN_PREVIEW_KEY)==="1")}catch{}},[]);
 useEffect(()=>{refreshProfile().finally(()=>setLoading(false));const{data:{subscription}}=supabase.auth.onAuthStateChange(()=>refreshProfile().finally(()=>setLoading(false)));if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(console.error);return()=>subscription.unsubscribe()},[supabase]);
 useEffect(()=>{const start=()=>setLocalBurnAnimation(true);const end=()=>setLocalBurnAnimation(false);window.addEventListener("tour-burn-animation-start",start);window.addEventListener("tour-burn-animation-end",end);return()=>{window.removeEventListener("tour-burn-animation-start",start);window.removeEventListener("tour-burn-animation-end",end)}},[]);
 useEffect(()=>{
  const userId=session?.user.id;if(!userId)return;
  const channel=supabase.channel(`app-provider-live:${userId}`)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${userId}`},payload=>{setActualProfile(payload.new as Profile)})
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},payload=>{setTourBurned(Boolean((payload.new as {tour_burned?:boolean}).tour_burned))})
   .subscribe();
  const sync=()=>{if(document.visibilityState==="visible")void refreshProfile()};
  document.addEventListener("visibilitychange",sync);window.addEventListener("focus",sync);
  return()=>{document.removeEventListener("visibilitychange",sync);window.removeEventListener("focus",sync);void supabase.removeChannel(channel)};
 },[session?.user.id,supabase]);
 const actualIsAdmin=Boolean(actualProfile?.is_admin);useEffect(()=>{if(actualProfile&&!actualIsAdmin)setAdminPreviewState(false)},[actualProfile,actualIsAdmin]);
 const setAdminPreview=(enabled:boolean)=>{if(enabled&&!actualIsAdmin)return;setAdminPreviewState(enabled);try{if(enabled)localStorage.setItem(ADMIN_PREVIEW_KEY,"1");else localStorage.removeItem(ADMIN_PREVIEW_KEY)}catch{}};
 const effectivePreview=adminPreview&&actualIsAdmin;
 const profile=useMemo(()=>{if(!actualProfile)return null;if(!effectivePreview)return actualProfile;return{...actualProfile,is_admin:false}as Profile},[actualProfile,effectivePreview]);
 const locked=tourBurned&&Boolean(session)&&!localBurnAnimation&&(!actualIsAdmin||effectivePreview);
 return <AppContext.Provider value={{session,profile,loading,refreshProfile,actualIsAdmin,adminPreview:effectivePreview,setAdminPreview}}>{children}<PushBootstrap/><DeviceHealthReporter/><TourBurnHomePortal/>{locked&&<TourBurn mode="final" preview={effectivePreview} onExitPreview={effectivePreview?()=>setAdminPreview(false):undefined}/>}</AppContext.Provider>
}
export function useApp(){const ctx=useContext(AppContext);if(!ctx)throw new Error("useApp must be used inside AppProvider");return ctx}
