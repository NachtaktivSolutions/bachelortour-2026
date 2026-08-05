"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

export function DeviceHealthReporter(){
  const {session,profile}=useApp();
  useEffect(()=>{
    if(!session||!profile||typeof window==="undefined")return;
    const supabase=createClient();
    let timer:number|undefined;
    const report=async()=>{
      const installed=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
      const pushSupported="Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window;
      let pushRegistered=false;
      try{const reg=await navigator.serviceWorker?.getRegistration("/");pushRegistered=Boolean(await reg?.pushManager.getSubscription())}catch{}
      const ua=navigator.userAgent;
      const browser=/SamsungBrowser/i.test(ua)?"Samsung Internet":/EdgA/i.test(ua)?"Edge":/Firefox/i.test(ua)?"Firefox":/CriOS|Chrome/i.test(ua)?"Chrome":/Safari/i.test(ua)?"Safari":"Anderer Browser";
      const platform=/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":"Sonstiges";
      await supabase.from("device_status").upsert({user_id:session.user.id,installed,online:navigator.onLine,push_supported:pushSupported,push_registered:pushRegistered,location_enabled:Boolean(profile.share_location),browser,platform,app_version:"42",last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id"});
    };
    report();
    timer=window.setInterval(report,60000);
    const onFocus=()=>report();
    window.addEventListener("focus",onFocus);window.addEventListener("online",onFocus);
    return()=>{if(timer)window.clearInterval(timer);window.removeEventListener("focus",onFocus);window.removeEventListener("online",onFocus)};
  },[session,profile]);
  return null;
}
