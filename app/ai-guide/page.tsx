"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, LocateFixed, MapPin, Navigation, Send, ShieldCheck, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";

type Message={role:"user"|"assistant";content:string;actions?:Action[]};
type Action={type:string;label:string;subtitle?:string;appUrl?:string;navigationUrl?:string};
type Location={latitude:number;longitude:number};
const starters=["Wo ist unser Hotel?","Was steht als Nächstes im Programm?","Wo ist hier eine gute Bar?","Welche Informationen sind freigeschaltet?"];

export default function AiGuidePage(){
  const supabase=useMemo(()=>createClient(),[]);
  const [messages,setMessages]=useState<Message[]>([{role:"assistant",content:"Servus! Ich bin der Firestarter KI-Guide. Ich kenne nur Inhalte, die in der App bereits für alle freigeschaltet sind. Versteckte Ziele und Programmpunkte kann ich technisch nicht sehen."}]);
  const [question,setQuestion]=useState("");
  const [location,setLocation]=useState<Location|null>(null);
  const [locationStatus,setLocationStatus]=useState("Standort nicht verwendet");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [placesConfigured,setPlacesConfigured]=useState(false);
  const [remaining,setRemaining]=useState<number|null>(null);
  const endRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{void loadStatus()},[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"end"})},[messages,busy]);
  async function authHeader(){const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du bist nicht angemeldet.");return{Authorization:`Bearer ${token}`}}
  async function loadStatus(){try{const headers=await authHeader();const r=await fetch("/api/ai-guide",{headers});const d=await r.json();if(!r.ok)throw new Error(d.error||"Status konnte nicht geladen werden.");setConfigured(Boolean(d.configured));setPlacesConfigured(Boolean(d.placesConfigured));setRemaining(d.remaining??null)}catch(e){setError(e instanceof Error?e.message:"Status konnte nicht geladen werden.")}}
  function useLocation(){if(!navigator.geolocation){setLocationStatus("Standort wird nicht unterstützt.");return}setLocationStatus("Standort wird ermittelt …");navigator.geolocation.getCurrentPosition(p=>{setLocation({latitude:p.coords.latitude,longitude:p.coords.longitude});setLocationStatus(`Standort aktiv · ca. ${Math.round(p.coords.accuracy)} m genau`)},e=>{setLocation(null);setLocationStatus(e.code===1?"Standort nicht freigegeben.":"Standort konnte nicht ermittelt werden.")},{enableHighAccuracy:true,timeout:12000,maximumAge:60000})}
  async function send(value?:string){const text=(value??question).trim();if(!text||busy)return;setQuestion("");setError("");setMessages(v=>[...v,{role:"user",content:text}]);setBusy(true);try{const headers=await authHeader();const history=messages.slice(-8).map(({role,content})=>({role,content}));const r=await fetch("/api/ai-guide",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({question:text,history,location})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Der KI-Guide konnte nicht antworten.");setMessages(v=>[...v,{role:"assistant",content:d.answer,actions:d.actions||[]}]);if(d.remaining!=null)setRemaining(d.remaining)}catch(e){setError(e instanceof Error?e.message:"Der KI-Guide konnte nicht antworten.")}finally{setBusy(false)}}
  function submit(e:FormEvent){e.preventDefault();void send()}
  return <AuthGate><Shell><div style={{display:"grid",gap:14,minHeight:"calc(100vh - 140px)"}}>
    <div className="page-heading" style={{marginBottom:0}}><span className="eyebrow">FIRESTARTER ASSISTENT</span><h1 style={{display:"flex",alignItems:"center",gap:10}}><Sparkles color="var(--accent)"/> KI-Guide</h1><p>Fragen zur Tour, zum Hotel, Programm und zu Orten in deiner Nähe.</p></div>
    <section style={{display:"grid",gap:10,padding:14,border:"1px solid #49301d",borderRadius:18,background:"linear-gradient(145deg,#25170e,#151515)"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><ShieldCheck color="#7dffad"/><div><strong>Geheimnisschutz aktiv</strong><small style={{display:"block",color:"#aaa"}}>Der Guide erhält nur für Teilnehmer sichtbare Daten. Versteckte Inhalte und Teilnehmerstandorte werden nie übertragen.</small></div></div><div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:12,color:"#bbb"}}><span style={pill(configured?"#245c3a":"#59351e")}>{configured?"KI verbunden":"KI nicht verbunden"}</span><span style={pill(placesConfigured?"#245c3a":"#333")}>{placesConfigured?"Erweiterte Ortssuche":"Kartensuche aktiv"}</span>{remaining!=null&&<span style={pill("#333")}>{remaining} Fragen übrig</span>}</div></section>
    <section style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",border:"1px solid #2b2b2b",borderRadius:16,background:"#151515"}}><div style={{display:"flex",gap:9,alignItems:"center"}}><LocateFixed size={20} color={location?"#7dffad":"#999"}/><span style={{fontSize:13,color:"#bbb"}}>{locationStatus}</span></div><button type="button" className="secondary-button" onClick={useLocation} style={{padding:"9px 12px",whiteSpace:"nowrap"}}>{location?"Aktualisieren":"Standort verwenden"}</button></section>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>{starters.map(x=><button key={x} type="button" onClick={()=>void send(x)} disabled={busy} style={{flex:"0 0 auto",maxWidth:250,border:"1px solid #303030",borderRadius:999,background:"#1b1b1b",color:"#ddd",padding:"9px 12px",fontSize:12}}>{x}</button>)}</div>
    <section style={{display:"flex",flexDirection:"column",gap:12,minHeight:320,maxHeight:"calc(100vh - 430px)",overflowY:"auto",padding:"4px 2px 12px"}}>{messages.map((m,i)=><article key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",width:"min(92%,680px)",padding:"13px 14px",borderRadius:m.role==="user"?"18px 18px 5px 18px":"18px 18px 18px 5px",background:m.role==="user"?"linear-gradient(135deg,#ff6a00,#d94d00)":"#1b1b1b",border:m.role==="user"?"0":"1px solid #2d2d2d"}}><div style={{display:"flex",gap:8,alignItems:"flex-start"}}>{m.role==="assistant"&&<Bot size={19} color="var(--accent)" style={{flex:"0 0 auto",marginTop:2}}/>}<p style={{margin:0,whiteSpace:"pre-wrap",lineHeight:1.5}}>{m.content}</p></div>{!!m.actions?.length&&<div style={{display:"grid",gap:8,marginTop:12}}>{m.actions.map((a,j)=><ActionCard key={`${a.label}-${j}`} action={a}/>)}</div>}</article>)}{busy&&<div style={{alignSelf:"flex-start",padding:"12px 15px",borderRadius:"18px 18px 18px 5px",background:"#1b1b1b",color:"#aaa"}}>KI denkt sicher nach …</div>}<div ref={endRef}/></section>
    {error&&<div className="error">{error}</div>}
    <form onSubmit={submit} style={{display:"grid",gridTemplateColumns:"1fr 50px",gap:8,position:"sticky",bottom:"calc(76px + var(--safe-bottom))",padding:10,border:"1px solid #2b2b2b",borderRadius:18,background:"rgba(15,15,15,.96)",backdropFilter:"blur(16px)",zIndex:20}}><textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={700} rows={2} placeholder="Frag den KI-Guide …" style={{minHeight:52,maxHeight:120,resize:"none",padding:12}}/><button type="submit" disabled={busy||!question.trim()} aria-label="Frage senden" style={{border:0,borderRadius:15,background:"var(--accent)",color:"white",display:"grid",placeItems:"center"}}><Send/></button></form>
  </div></Shell></AuthGate>
}
function ActionCard({action}:{action:Action}){const content=<><span style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"#2b1a0e",color:"var(--accent)"}}>{action.type==="place"?<MapPin size={20}/>:<ExternalLink size={20}/>}</span><span style={{minWidth:0,flex:1}}><strong style={{display:"block"}}>{action.label}</strong>{action.subtitle&&<small style={{display:"block",color:"#999",overflow:"hidden",textOverflow:"ellipsis"}}>{action.subtitle}</small>}</span><Navigation size={18}/></>;const style={display:"flex",alignItems:"center",gap:10,padding:10,border:"1px solid #363636",borderRadius:14,background:"#111",color:"white"} as const;return action.appUrl?<Link href={action.appUrl} style={style}>{content}</Link>:<a href={action.navigationUrl||"#"} target="_blank" rel="noreferrer" style={style}>{content}</a>}
function pill(background:string){return{padding:"5px 9px",borderRadius:999,background,border:"1px solid rgba(255,255,255,.1)"} as const}
