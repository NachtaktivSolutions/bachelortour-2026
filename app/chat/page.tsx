"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, ChangeEvent } from "react";
import { Send, ImagePlus, Smile } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { EmojiPicker } from "@/components/emoji-picker";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const { profile } = useApp();
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [uploading,setUploading]=useState(false);
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [text,setText]=useState("");
  const [initialScrollDone,setInitialScrollDone]=useState(false);
  const listRef=useRef<HTMLDivElement>(null);
  const supabase=createClient();

  const markRead = useCallback(async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ chat_last_read_at: new Date().toISOString() }).eq("id", profile.id);
    window.dispatchEvent(new Event("chat-read"));
  }, [profile?.id, supabase]);

  const load = useCallback(async (scrollForNew = false) => {
    const container = listRef.current;
    const wasNearBottom = container ? container.scrollHeight - container.scrollTop - container.clientHeight < 120 : true;
    const { data } = await supabase.from("chat_messages").select("*, profiles(name,avatar_url)").order("created_at").limit(300);
    setMessages((data as ChatMessage[]) ?? []);
    await markRead();
    window.requestAnimationFrame(() => {
      const current = listRef.current;
      if (!current) return;
      if (!initialScrollDone || (scrollForNew && wasNearBottom)) current.scrollTop = current.scrollHeight;
      if (!initialScrollDone) setInitialScrollDone(true);
    });
  }, [initialScrollDone, markRead, supabase]);

  useEffect(() => {
    load(false);
    const channel=supabase.channel("chat")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},()=>load(true))
      .subscribe();
    const onVisible=()=>{ if(document.visibilityState==="visible") markRead(); };
    document.addEventListener("visibilitychange",onVisible);
    return()=>{document.removeEventListener("visibilitychange",onVisible);supabase.removeChannel(channel)};
  },[load,markRead,supabase]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const body=text.trim();if(!body||!profile)return;
    const {error}=await supabase.from("chat_messages").insert({body,sender_id:profile.id});
    if(!error){setText("");setEmojiOpen(false);window.setTimeout(()=>{const c=listRef.current;if(c)c.scrollTop=c.scrollHeight},50)}
  }

  async function sendImage(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file||!profile)return;
    setUploading(true);
    const path=`${profile.id}/${Date.now()}-${file.name.replace(/\s+/g,"-")}`;
    const up=await supabase.storage.from("photos").upload(path,file);
    if(!up.error){
      const url=supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      await supabase.from("chat_messages").insert({body:"📷 Foto",image_url:url,sender_id:profile.id});
    }
    setUploading(false);e.target.value="";
  }

  return <AuthGate><Shell>
    <div className="chat-page-shell">
      <div className="page-heading chat-heading"><span className="eyebrow">FIRESTARTER-GRUPPE</span><h1>Gruppenchat</h1><p>Wo seid ihr? Wer bestellt die nächste Runde?</p></div>
      <div className="chat-list" ref={listRef}>{messages.map(m=><div key={m.id} className={`message-row ${m.sender_id===profile?.id?"own":""}`}>{m.sender_id!==profile?.id&&<div className="avatar chat-avatar">{m.profiles?.avatar_url?<img src={m.profiles.avatar_url} alt=""/>:<span>{m.profiles?.name?.[0]||"?"}</span>}</div>}<div className={`message ${m.sender_id===profile?.id?"own":""}`}><strong>{m.sender_id===profile?.id?"Du":m.profiles?.name}</strong>{m.image_url&&<img className="chat-image" src={m.image_url} alt="Chatfoto"/>}{m.body&&m.body!=="📷 Foto"&&<p>{m.body}</p>}<small>{new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit"}).format(new Date(m.created_at))}</small></div></div>)}</div>
      {emojiOpen&&<EmojiPicker onPick={emoji=>setText(t=>t+emoji)}/>} 
      <form className="chat-composer" onSubmit={send}><label className="composer-image"><ImagePlus/><input type="file" accept="image/*" capture="environment" onChange={sendImage}/></label><button type="button" className="composer-emoji" onClick={()=>setEmojiOpen(v=>!v)}><Smile/></button><input value={text} onChange={e=>setText(e.target.value)} placeholder={uploading?"Foto wird hochgeladen …":"Nachricht schreiben …"} autoComplete="off" disabled={uploading}/><button aria-label="Senden"><Send/></button></form>
    </div>
  </Shell></AuthGate>;
}
