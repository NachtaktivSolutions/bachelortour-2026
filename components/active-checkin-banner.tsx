"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, MapPin, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

type CheckinEvent={id:string;title:string;description:string|null;starts_at:string|null;closes_at:string|null;is_open:boolean};
type Checkin={event_id:string;user_id:string};

export function ActiveCheckinBanner(){
  const {profile}=useApp();
  const supabase=createClient();
  const [event,setEvent]=useState<CheckinEvent|null>(null);
  const [checkins,setCheckins]=useState<Checkin[]>([]);
  const [memberCount,setMemberCount]=useState(0);
  const [now,setNow]=useState(Date.now());
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const currentIso=new Date().toISOString();
    const [eventResult,checkinResult,memberResult]=await Promise.all([
      supabase.from("checkin_events").select("id,title,description,starts_at,closes_at,is_open").eq("is_open",true).or(`closes_at.is.null,closes_at.gt.${currentIso}`).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("checkins").select("event_id,user_id"),
      supabase.from("profiles").select("id",{count:"exact",head:true})
    ]);
    setEvent((eventResult.data as CheckinEvent|null)??null);
    setCheckins((checkinResult.data as Checkin[])??[]);
    setMemberCount(memberResult.count??0);
  },[supabase]);

  useEffect(()=>{
    load();
    const channel=supabase.channel("home-active-checkin").on("postgres_changes",{event:"*",schema:"public",table:"checkin_events"},load).on("postgres_changes",{event:"*",schema:"public",table:"checkins"},load).subscribe();
    const timer=window.setInterval(()=>{setNow(Date.now());load()},30000);
    return()=>{window.clearInterval(timer);supabase.removeChannel(channel)};
  },[load,supabase]);

  const active=useMemo(()=>{
    if(!event?.is_open)return null;
    if(event.starts_at&&new Date(event.starts_at).getTime()>now)return null;
    if(event.closes_at&&new Date(event.closes_at).getTime()<=now)return null;
    return event;
  },[event,now]);
  const eventCheckins=active?checkins.filter(item=>item.event_id===active.id):[];
  const checked=Boolean(profile&&eventCheckins.some(item=>item.user_id===profile.id));
  const progress=memberCount?Math.min(100,Math.round(eventCheckins.length/memberCount*100)):0;

  async function checkIn(){
    if(!active||!profile||checked||busy)return;
    setBusy(true);
    const {error}=await supabase.from("checkins").insert({event_id:active.id,user_id:profile.id});
    if(!error)await load();
    setBusy(false);
  }

  if(!active)return null;
  return <section className="home-checkin-banner">
    <div className="home-checkin-top"><span className="home-checkin-icon"><UserCheck/></span><div><span className="eyebrow">CHECK-IN JETZT AKTIV</span><h2>{active.title}</h2>{active.description&&<p>{active.description}</p>}</div><Link href="/tour-tools" aria-label="Check-in öffnen"><ChevronRight/></Link></div>
    <div className="home-checkin-progress"><div><strong>{eventCheckins.length} von {memberCount}</strong><span>bereits eingecheckt</span></div><div className="home-checkin-track"><span style={{width:`${progress}%`}}/></div></div>
    {checked?<Link className="home-checkin-button checked" href="/tour-tools"><CheckCircle2/>Du bist eingecheckt</Link>:<button className="home-checkin-button" onClick={checkIn} disabled={busy}><MapPin/>{busy?"Wird eingecheckt …":"Jetzt einchecken"}</button>}
  </section>;
}
