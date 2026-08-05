"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

const REPORT_INTERVAL_MS=5*60*1000;
const MIN_REPORT_GAP_MS=30*1000;

export function DeviceHealthReporter(){
  const {session,profile}=useApp();
  const lastReport=useRef(0);
  useEffect(()=>{
    if(!session?.user.id||!profile||typeof window==="undefined")return;
    const supabase=createClient();
    let timer:number|undefined;
    let stopped=false;
    const report=async(force=false)=>{
      if(stopped||document.visibilityState!=="visible")return;
      const now=Date.now();
      if(!force&&now-lastReport.current<MIN_REPORT_GAP_MS)return;
      lastReport.current=now;
      const installed=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
      const pushSupported="Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window;
      let pushRegistered=false;
      try{const reg=await navigator.serviceWorker?.getRegistration("/");pushRegistered=Boolean(await reg?.pushManager.getSubscription())}catch{}
      const ua=navigator.userAgent;
      const browser=/SamsungBrowser/i.test(ua)?"Samsung Internet":/EdgA/i.test(ua)?"Edge":/Firefox/i.test(ua)?"Firefox":/CriOS|Chrome/i.test(ua)?"Chrome":/Safari/i.test(ua)?"Safari":"Anderer Browser";
      const platform=/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":"Sonstiges";
      await supabase.from("device_status").upsert({user_id:session.user.id,installed,online:navigator.onLine,push_supported:pushSupported,push_registered:pushRegistered,location_enabled:Boolean(profile.share_location),browser,platform,app_version:"43",last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id"});
    };
    report(true);
    timer=window.setInterval(()=>report(),REPORT_INTERVAL_MS);
    const onFocus=()=>report();
    const onVisibility=()=>{if(document.visibilityState==="visible")report()};
    window.addEventListener("focus",onFocus);window.addEventListener("online",onFocus);document.addEventListener("visibilitychange",onVisibility);
    return()=>{stopped=true;if(timer)window.clearInterval(timer);window.removeEventListener("focus",onFocus);window.removeEventListener("online",onFocus);document.removeEventListener("visibilitychange",onVisibility)};
  },[session?.user.id,profile?.share_location]);
  return null;
}
