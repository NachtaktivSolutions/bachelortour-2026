"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const { profile } = useApp();
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const end=useRef<HTMLDivElement>(null);
  const supabase=createClient();

  const load=()=>supabase.from("chat_messages").select("*, profiles(name,avatar_url)").order("created_at").limit(300).then(({data})=>setMessages((data as ChatMessage[])??[]));
  useEffect(()=>{
    load();
    const channel=supabase.channel("chat").on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},load).subscribe();
    return()=>{supabase.removeChannel(channel)}
  },[]);
  useEffect(()=>end.current?.scrollIntoView({behavior:"smooth"}),[messages]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const form=new FormData(e.currentTarget); const body=String(form.get("body")).trim();
    if(!body||!profile)return;
    await supabase.from("chat_messages").insert({body,sender_id:profile.id});
    e.currentTarget.reset();
  }

  return <AuthGate><Shell>
    <div className="page-heading"><h1>Gruppenchat</h1><p>Was geht wo?</p></div>
    <div className="chat-list">
      {messages.map(m=><div key={m.id} className={`message ${m.sender_id===profile?.id?"own":""}`}>
        <strong>{m.sender_id===profile?.id?"Du":m.profiles?.name}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</small>
      </div>)}<div ref={end}/>
    </div>
    <form className="chat-composer" onSubmit={send}><input name="body" placeholder="Nachricht schreiben …" autoComplete="off"/><button aria-label="Senden"><Send/></button></form>
  </Shell></AuthGate>;
}
