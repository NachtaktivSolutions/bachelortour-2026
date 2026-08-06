"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PushBootstrap } from "./push-settings";
import { DeviceHealthReporter } from "./device-health-reporter";

const ADMIN_PREVIEW_KEY="firestarter-admin-participant-preview";

type AppContextValue = {session:Session|null;profile:Profile|null;loading:boolean;refreshProfile:()=>Promise<void>;actualIsAdmin:boolean;adminPreview:boolean;setAdminPreview:(enabled:boolean)=>void};
const AppContext=createContext<AppContextValue|undefined>(undefined);

export function AppProvider({children}:{children:React.ReactNode}){
 const supabase=useMemo(()=>createClient(),[]);const[session,setSession]=useState<Session|null>(null);const[actualProfile,setActualProfile]=useState<Profile|null>(null);const[loading,setLoading]=useState(true);const[adminPreview,setAdminPreviewState]=useState(false);
 const refreshProfile=async()=>{const{data:{session:currentSession}}=await supabase.auth.getSession();setSession(currentSession);if(!currentSession){setActualProfile(null);setAdminPreviewState(false);return}const{data}=await supabase.from("profiles").select("*").eq("id",currentSession.user.id).single();setActualProfile(data??null)};
 useEffect(()=>{try{setAdminPreviewState(localStorage.getItem(ADMIN_PREVIEW_KEY)==="1")}catch{}},[]);
 useEffect(()=>{refreshProfile().finally(()=>setLoading(false));const{data:{subscription}}=supabase.auth.onAuthStateChange(()=>refreshProfile().finally(()=>setLoading(false)));if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(console.error);return()=>subscription.unsubscribe()},[supabase]);
 useEffect(()=>{
  const userId=session?.user.id;if(!userId)return;
  const channel=supabase.channel(`own-profile-live:${userId}`)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${userId}`},payload=>{
    setActualProfile(payload.new as Profile);
   })
   .subscribe();
  const sync=()=>{if(document.visibilityState==="visible")void refreshProfile()};
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("focus",sync);
  return()=>{document.removeEventListener("visibilitychange",sync);window.removeEventListener("focus",sync);void supabase.removeChannel(channel)};
 },[session?.user.id,supabase]);
 const actualIsAdmin=Boolean(actualProfile?.is_admin);useEffect(()=>{if(actualProfile&&!actualIsAdmin)setAdminPreviewState(false)},[actualProfile,actualIsAdmin]);
 const setAdminPreview=(enabled:boolean)=>{if(enabled&&!actualIsAdmin)return;setAdminPreviewState(enabled);try{if(enabled)localStorage.setItem(ADMIN_PREVIEW_KEY,"1");else localStorage.removeItem(ADMIN_PREVIEW_KEY)}catch{}};
 const profile=useMemo(()=>{if(!actualProfile)return null;if(!adminPreview||!actualIsAdmin)return actualProfile;return{...actualProfile,is_admin:false}as Profile},[actualProfile,adminPreview,actualIsAdmin]);
 return <AppContext.Provider value={{session,profile,loading,refreshProfile,actualIsAdmin,adminPreview:adminPreview&&actualIsAdmin,setAdminPreview}}>{children}<PushBootstrap/><DeviceHealthReporter/></AppContext.Provider>
}
export function useApp(){const ctx=useContext(AppContext);if(!ctx)throw new Error("useApp must be used inside AppProvider");return ctx}
