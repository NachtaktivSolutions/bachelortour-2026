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
  const { profile, refreshProfile } = useApp();
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [uploading,setUploading]=useState(false);
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [text,setText]=useState("");
  const end=useRef<HTMLDivElement>(null);
  const supabase=createClient();

  const markRead = useCallback(async () => {
    if (!profile) return;
    const now = new Date().toISOString();
    await supabase.from("profiles").update({ chat_last_read_at: now }).eq("id", profile.id);
    window.dispatchEvent(new Event("chat-read"));
    await refreshProfile();
  }, [profile, refreshProfile, supabase]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("chat_messages").select("*, profiles(name,avatar_url)").order("created_at").limit(300);
    setMessages((data as ChatMessage[]) ?? []);
    await markRead();
  }, [markRead, supabase]);

  useEffect(() => {
    load();
    const channel=supabase.channel("chat")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},load)
      .subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[load,supabase]);

  useEffect(()=>end.current?.scrollIntoView({behavior:"smooth"}),[messages]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const body=text.trim();if(!body||!profile)return;
    await supabase.from("chat_messages").insert({body,sender_id:profile.id});
    setText("");setEmojiOpen(false);
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

  return <AuthGate><Shell><div className="page-heading"><span className="eyebrow">FIRESTARTER-GRUPPE</span><h1>Gruppenchat</h1><p>Wo seid ihr? Wer bestellt die nächste Runde?</p></div>
    <div className="chat-list">{messages.map(m=><div key={m.id} className={`message-row ${m.sender_id===profile?.id?"own":""}`}>{m.sender_id!==profile?.id&&<div className="avatar chat-avatar">{m.profiles?.avatar_url?<img src={m.profiles.avatar_url} alt=""/>:<span>{m.profiles?.name?.[0]||"?"}</span>}</div>}<div className={`message ${m.sender_id===profile?.id?"own":""}`}><strong>{m.sender_id===profile?.id?"Du":m.profiles?.name}</strong>{m.image_url&&<img className="chat-image" src={m.image_url} alt="Chatfoto"/>}{m.body&&m.body!=="📷 Foto"&&<p>{m.body}</p>}<small>{new Date(m.created_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</small></div></div>)}<div ref={end}/></div>
    {emojiOpen&&<EmojiPicker onPick={emoji=>setText(t=>t+emoji)}/>}
    <form className="chat-composer" onSubmit={send}><label className="composer-image"><ImagePlus/><input type="file" accept="image/*" capture="environment" onChange={sendImage}/></label><button type="button" className="composer-emoji" onClick={()=>setEmojiOpen(v=>!v)}><Smile/></button><input value={text} onChange={e=>setText(e.target.value)} placeholder={uploading?"Foto wird hochgeladen …":"Nachricht schreiben …"} autoComplete="off" disabled={uploading}/><button aria-label="Senden"><Send/></button></form>
  </Shell></AuthGate>;
}
