"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BellRing, Clock3, Send, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import { berlinLocalToIso, formatBerlinDateTime } from "@/lib/datetime";

type ScheduledJob={id:string;job_type:string;payload:Record<string,any>;scheduled_for:string;status:string;error:string|null};

export default function AdminRemindersPage(){
  const {session}=useApp();
  const supabase=createClient();
  const [jobs,setJobs]=useState<ScheduledJob[]>([]);
  const [status,setStatus]=useState("");

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from("scheduled_jobs").select("*").eq("job_type","push").order("scheduled_for",{ascending:false}).limit(100);
    if(error)setStatus(error.message);else setJobs(data??[]);
  },[supabase]);
  useEffect(()=>{load()},[load]);

  async function scheduleReminder(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
    const when=berlinLocalToIso(String(f.get("scheduled_for")));
    const payload={title:String(f.get("title")).trim(),body:String(f.get("body")).trim(),url:String(f.get("url"))||"/"};
    const {error}=await supabase.from("scheduled_jobs").insert({job_type:"push",payload,scheduled_for:when,created_by:session?.user.id});
    setStatus(error?error.message:"Erinnerung wurde geplant.");if(!error)form.reset();await load();
  }

  async function remove(id:string){
    if(!confirm("Geplante Erinnerung wirklich löschen?"))return;
    const {error}=await supabase.from("scheduled_jobs").delete().eq("id",id);
    setStatus(error?error.message:"Erinnerung gelöscht.");await load();
  }

  const pending=jobs.filter(j=>j.status==="pending");
  const completed=jobs.filter(j=>j.status!=="pending");

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">AUTOMATIK</span><h1>Erinnerungen</h1><p>Push-Nachrichten unabhängig von Notfallbereich und Check-ins vorbereiten.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-tool-grid">
      <form className="admin-card" onSubmit={scheduleReminder}><BellRing/><h2>Neue Erinnerung</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Push-Nachricht" required/><label><Clock3/>Datum und Uhrzeit<input name="scheduled_for" type="datetime-local" required/></label><select name="url" defaultValue="/"><option value="/">Startseite</option><option value="/tour-tools">Hilfe & Check-in</option><option value="/packing-list">Packliste</option><option value="/program">Programm</option><option value="/map">Karte</option><option value="/chat">Chat</option></select><button className="primary-button"><Send/>Erinnerung planen</button></form>
    </div>
    <section className="admin-list-section"><h2>Geplante Erinnerungen</h2>{pending.length?pending.map(job=><div className="admin-compact-row" key={job.id}><div><strong>{job.payload.title}</strong><small>{formatBerlinDateTime(job.scheduled_for)} · {job.payload.body}</small></div><button onClick={()=>remove(job.id)} aria-label="Löschen"><Trash2/></button></div>):<div className="empty-card">Keine Erinnerung geplant.</div>}</section>
    <section className="admin-list-section"><h2>Verlauf</h2>{completed.length?completed.slice(0,30).map(job=><div className="admin-compact-row" key={job.id}><div><strong>{job.payload.title}</strong><small>{formatBerlinDateTime(job.scheduled_for)} · {job.status}{job.error?` · ${job.error}`:""}</small></div></div>):<div className="empty-card">Noch keine versendeten Erinnerungen.</div>}</section>
  </Shell></AuthGate>;
}
