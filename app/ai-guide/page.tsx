"use client";

import "./ai-guide.css";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, MapPin, Navigation, Send, Sparkles, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Message={role:"user"|"assistant";content:string;actions?:Action[]};
type Action={type:string;label:string;subtitle?:string;appUrl?:string;navigationUrl?:string};
type Location={latitude:number;longitude:number};
type StoredChat={updatedAt:number;messages:Message[]};

const CHAT_TTL_MS=6*60*60*1000;
const MAX_STORED_MESSAGES=40;
const CHAT_STORAGE_PREFIX="firestarter-ai-guide-chat-v1";

const starters=[
  {label:"🍻 Gute Bars",question:"Wo gibt es hier gute Bars?"},
  {label:"🍕 Hunger",question:"Wo können wir hier gut essen?"},
  {label:"📅 Was steht an?",question:"Was steht als Nächstes an?"},
  {label:"🏨 Unser Hotel",question:"Wo ist unser Hotel?"},
  {label:"🚕 Taxi",question:"Wo finde ich hier ein Taxi?"},
  {label:"💊 Apotheke",question:"Wo ist die nächste Apotheke?"},
  {label:"🚻 Toilette",question:"Wo ist die nächste Toilette?"}
];

function greeting(firstName:string):Message{
  return{role:"assistant",content:`👋 Hi${firstName?` ${firstName}`:""}! Ich begleite euch durch die Tour. Frag mich nach eurem Programm, dem Hotel oder nach Tipps in deiner Umgebung.`};
}

export default function AiGuidePage(){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const firstName=profile?.name?.split(" ")[0]||"";
  const storageKey=profile?.id?`${CHAT_STORAGE_PREFIX}:${profile.id}`:"";
  const [messages,setMessages]=useState<Message[]>([greeting("")]);
  const [chatLoaded,setChatLoaded]=useState(false);
  const [question,setQuestion]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const endRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!storageKey)return;
    let restored:Message[]|null=null;
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const stored=JSON.parse(raw)as StoredChat;
        if(Number.isFinite(stored.updatedAt)&&Date.now()-stored.updatedAt<CHAT_TTL_MS&&Array.isArray(stored.messages)&&stored.messages.length){
          restored=stored.messages.slice(-MAX_STORED_MESSAGES);
        }else{
          localStorage.removeItem(storageKey);
        }
      }
    }catch{
      try{localStorage.removeItem(storageKey)}catch{}
    }
    setMessages(restored||[greeting(firstName)]);
    setChatLoaded(true);
    window.setTimeout(()=>endRef.current?.scrollIntoView({block:"end"}),50);
  },[storageKey,firstName]);

  useEffect(()=>{
    if(!storageKey||!chatLoaded)return;
    try{
      const payload:StoredChat={updatedAt:Date.now(),messages:messages.slice(-MAX_STORED_MESSAGES)};
      localStorage.setItem(storageKey,JSON.stringify(payload));
    }catch{}
  },[messages,storageKey,chatLoaded]);

  const location:Location|null=profile?.share_location&&Number.isFinite(Number(profile.latitude))&&Number.isFinite(Number(profile.longitude))
    ?{latitude:Number(profile.latitude),longitude:Number(profile.longitude)}
    :null;

  async function authHeader(){const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du bist nicht angemeldet.");return{Authorization:`Bearer ${token}`}}

  async function send(value?:string){
    const text=(value??question).trim();if(!text||busy)return;
    setQuestion("");setError("");setMessages(current=>[...current,{role:"user",content:text}].slice(-MAX_STORED_MESSAGES));setBusy(true);
    window.setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth",block:"end"}),60);
    try{
      const headers=await authHeader();
      const history=messages.slice(-8).map(({role,content})=>({role,content}));
      const response=await fetch("/api/ai-guide",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({question:text,history,location})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Ich konnte gerade nicht antworten.");
      setMessages(current=>[...current,{role:"assistant",content:data.answer,actions:data.actions||[]}].slice(-MAX_STORED_MESSAGES));
    }catch(e){setError(e instanceof Error?e.message:"Ich konnte gerade nicht antworten.")}finally{setBusy(false);window.setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth",block:"end"}),80)}
  }

  function clearChat(){
    if(busy)return;
    try{if(storageKey)localStorage.removeItem(storageKey)}catch{}
    setMessages([greeting(firstName)]);
    setError("");
    setQuestion("");
  }

  function submit(event:FormEvent){event.preventDefault();void send()}

  return <AuthGate><Shell>
    <div className="ai-guide-page">
      <header className="ai-guide-intro">
        <span className="ai-guide-orb"><Sparkles/></span>
        <div><span className="eyebrow">DEIN TOURBEGLEITER</span><h1>Was kann ich für dich tun?</h1><p>Programm, Hotel, Essen, Bars oder schnelle Hilfe unterwegs.</p></div>
        {messages.length>1&&<button type="button" onClick={clearChat} disabled={busy} aria-label="Chat leeren" title="Chat leeren" style={{marginLeft:"auto",alignSelf:"flex-start",width:42,height:42,padding:10,borderRadius:999,border:"1px solid #3a3a3a",background:"#1b1b1b",color:"#aaa",display:"grid",placeItems:"center",flex:"0 0 auto"}}><Trash2/></button>}
      </header>

      <div className="ai-guide-starters">{starters.map(item=><button key={item.label} type="button" onClick={()=>void send(item.question)} disabled={busy}>{item.label}</button>)}</div>

      <section className="ai-guide-chat">
        {messages.map((message,index)=><article key={index} className={`ai-message ${message.role}`}>
          {message.role==="assistant"&&<span className="ai-avatar"><Bot/></span>}
          <div className="ai-bubble"><p>{message.content}</p>{!!message.actions?.length&&<div className="ai-actions">{message.actions.map((action,i)=><ActionCard key={`${action.label}-${i}`} action={action}/>)}</div>}</div>
        </article>)}
        {busy&&<article className="ai-message assistant"><span className="ai-avatar"><Bot/></span><div className="ai-bubble ai-thinking"><i/><i/><i/></div></article>}
        <div ref={endRef}/>
      </section>

      {error&&<div className="error">{error}</div>}
      <form className="ai-composer" onSubmit={submit}><textarea value={question} onChange={event=>setQuestion(event.target.value)} maxLength={700} rows={1} placeholder="Frag mich irgendetwas …"/><button type="submit" disabled={busy||!question.trim()} aria-label="Frage senden"><Send/></button></form>
    </div>
  </Shell></AuthGate>
}

function ActionCard({action}:{action:Action}){
  const content=<><span className="ai-action-icon">{action.type==="place"?<MapPin/>:<ExternalLink/>}</span><span><strong>{action.label}</strong>{action.subtitle&&<small>{action.subtitle}</small>}</span><Navigation/></>;
  return action.appUrl?<Link href={action.appUrl} className="ai-action-card">{content}</Link>:<a href={action.navigationUrl||"#"} target="_blank" rel="noreferrer" className="ai-action-card">{content}</a>
}
