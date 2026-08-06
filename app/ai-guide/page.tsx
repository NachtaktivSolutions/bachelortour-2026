"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, MapPin, Navigation, Send, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Message={role:"user"|"assistant";content:string;actions?:Action[]};
type Action={type:string;label:string;subtitle?:string;appUrl?:string;navigationUrl?:string};
type Location={latitude:number;longitude:number};

const starters=[
  {label:"🍻 Gute Bars",question:"Wo gibt es hier gute Bars?"},
  {label:"🍕 Hunger",question:"Wo können wir hier gut essen?"},
  {label:"📅 Was steht an?",question:"Was steht als Nächstes an?"},
  {label:"🏨 Unser Hotel",question:"Wo ist unser Hotel?"},
  {label:"🚕 Taxi",question:"Wo finde ich hier ein Taxi?"},
  {label:"💊 Apotheke",question:"Wo ist die nächste Apotheke?"},
  {label:"🚻 Toilette",question:"Wo ist die nächste Toilette?"}
];

export default function AiGuidePage(){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const firstName=profile?.name?.split(" ")[0]||"";
  const [messages,setMessages]=useState<Message[]>([{role:"assistant",content:`👋 Hi${firstName?` ${firstName}`:""}! Ich begleite euch durch die Tour. Frag mich nach eurem Programm, dem Hotel oder nach Tipps in deiner Umgebung.`}]);
  const [question,setQuestion]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const endRef=useRef<HTMLDivElement|null>(null);

  const location:Location|null=profile?.share_location&&Number.isFinite(Number(profile.latitude))&&Number.isFinite(Number(profile.longitude))
    ?{latitude:Number(profile.latitude),longitude:Number(profile.longitude)}
    :null;

  async function authHeader(){const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du bist nicht angemeldet.");return{Authorization:`Bearer ${token}`}}

  async function send(value?:string){
    const text=(value??question).trim();if(!text||busy)return;
    setQuestion("");setError("");setMessages(current=>[...current,{role:"user",content:text}]);setBusy(true);
    window.setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth",block:"end"}),60);
    try{
      const headers=await authHeader();
      const history=messages.slice(-8).map(({role,content})=>({role,content}));
      const response=await fetch("/api/ai-guide",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({question:text,history,location})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Ich konnte gerade nicht antworten.");
      setMessages(current=>[...current,{role:"assistant",content:data.answer,actions:data.actions||[]}]);
    }catch(e){setError(e instanceof Error?e.message:"Ich konnte gerade nicht antworten.")}finally{setBusy(false);window.setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth",block:"end"}),80)}
  }

  function submit(event:FormEvent){event.preventDefault();void send()}

  return <AuthGate><Shell>
    <div className="ai-guide-page">
      <header className="ai-guide-intro">
        <span className="ai-guide-orb"><Sparkles/></span>
        <div><span className="eyebrow">DEIN TOURBEGLEITER</span><h1>Was kann ich für dich tun?</h1><p>Programm, Hotel, Essen, Bars oder schnelle Hilfe unterwegs.</p></div>
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
