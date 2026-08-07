"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, ImagePlus, Lock, Pin, Send, Smile, Trash2, Unlock, X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { EmojiPicker } from "@/components/emoji-picker";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import { optimizeImage, validateImageFile } from "@/lib/image-upload";
import type { ChatMessage } from "@/lib/types";
import styles from "./chat.module.css";

type ChatSettings = { chat_locked:boolean; pinned_chat_message_id:string|null };
type Reaction = { message_id:string; user_id:string; emoji:string };
const REACTIONS=["👍","❤️","😂","🔥","🍺","🌿"];

export default function ChatPage() {
  const { profile } = useApp();
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [reactions,setReactions]=useState<Reaction[]>([]);
  const [reactionOpen,setReactionOpen]=useState<string|null>(null);
  const [settings,setSettings]=useState<ChatSettings>({chat_locked:false,pinned_chat_message_id:null});
  const [uploading,setUploading]=useState(false);
  const [uploadStatus,setUploadStatus]=useState("");
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [text,setText]=useState("");
  const [initialScrollDone,setInitialScrollDone]=useState(false);
  const [selectionMode,setSelectionMode]=useState(false);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [status,setStatus]=useState("");
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
    const [{data},{data:settingsData},{data:reactionData}] = await Promise.all([
      supabase.from("chat_messages").select("*, profiles(name,avatar_url)").order("created_at").limit(300),
      supabase.from("event_settings").select("chat_locked,pinned_chat_message_id").eq("id",1).maybeSingle(),
      supabase.from("chat_message_reactions").select("message_id,user_id,emoji")
    ]);
    setMessages((data as ChatMessage[]) ?? []);
    setReactions((reactionData as Reaction[]) ?? []);
    setSettings({chat_locked:Boolean(settingsData?.chat_locked),pinned_chat_message_id:settingsData?.pinned_chat_message_id??null});
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
      .on("postgres_changes",{event:"*",schema:"public",table:"chat_messages"},()=>load(true))
      .on("postgres_changes",{event:"*",schema:"public",table:"chat_message_reactions"},()=>load(false))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"event_settings",filter:"id=eq.1"},()=>load(false))
      .subscribe();
    const onVisible=()=>{ if(document.visibilityState==="visible") markRead(); };
    document.addEventListener("visibilitychange",onVisible);
    return()=>{document.removeEventListener("visibilitychange",onVisible);supabase.removeChannel(channel)};
  },[load,markRead,supabase]);

  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const body=text.trim();if(!body||!profile||settings.chat_locked&&!profile.is_admin)return;
    const {error}=await supabase.from("chat_messages").insert({body,sender_id:profile.id});
    if(error){setStatus(error.message);return}
    setText("");setEmojiOpen(false);window.setTimeout(()=>{const c=listRef.current;if(c)c.scrollTop=c.scrollHeight},50);
  }

  async function sendImage(e:ChangeEvent<HTMLInputElement>){
    const original=e.target.files?.[0];if(!original||!profile||settings.chat_locked&&!profile.is_admin)return;
    setUploading(true);setStatus("");
    try{
      validateImageFile(original);
      const file=await optimizeImage(original,setUploadStatus);
      setUploadStatus("Foto wird hochgeladen …");
      const path=`${profile.id}/${Date.now()}-${file.name.replace(/\s+/g,"-")}`;
      const up=await supabase.storage.from("photos").upload(path,file,{cacheControl:"31536000",contentType:"image/jpeg"});
      if(up.error)throw up.error;
      const url=supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      const galleryInsert=await supabase.from("photos").insert({image_url:url,uploader_id:profile.id,caption:"Aus dem Gruppenchat"});
      if(galleryInsert.error)throw galleryInsert.error;
      const chatInsert=await supabase.from("chat_messages").insert({body:"📷 Foto",image_url:url,sender_id:profile.id});
      if(chatInsert.error)throw chatInsert.error;
    }catch(error){setStatus(error instanceof Error?error.message:"Foto konnte nicht hochgeladen werden.")}
    finally{setUploading(false);setUploadStatus("");e.target.value=""}
  }

  async function react(messageId:string,emoji:string){
    if(!profile)return;
    const existing=reactions.find(r=>r.message_id===messageId&&r.user_id===profile.id);
    const result=existing?.emoji===emoji
      ? await supabase.from("chat_message_reactions").delete().eq("message_id",messageId).eq("user_id",profile.id)
      : await supabase.from("chat_message_reactions").upsert({message_id:messageId,user_id:profile.id,emoji},{onConflict:"message_id,user_id"});
    if(result.error)setStatus(result.error.message);else{setReactionOpen(null);await load(false)}
  }

  async function removeMessages(ids:string[]){
    if(!profile?.is_admin||!ids.length)return;
    const label=ids.length===1?"diese Nachricht":`${ids.length} Nachrichten`;
    if(!confirm(`${label} wirklich löschen?`))return;
    const {error}=await supabase.from("chat_messages").delete().in("id",ids);
    if(error)setStatus(error.message);else{setStatus(`${label} gelöscht.`);setSelected(new Set());setSelectionMode(false);await load(false)}
  }

  async function clearChat(){
    if(!profile?.is_admin)return;
    const answer=prompt('Zum vollständigen Leeren bitte exakt "CHAT LÖSCHEN" eingeben.');
    if(answer!=="CHAT LÖSCHEN")return;
    const {error}=await supabase.from("chat_messages").delete().neq("id","00000000-0000-0000-0000-000000000000");
    if(error)setStatus(error.message);else{setStatus("Der gesamte Chat wurde geleert.");setSelected(new Set());await load(false)}
  }

  async function toggleLock(){
    if(!profile?.is_admin)return;
    const {error}=await supabase.from("event_settings").update({chat_locked:!settings.chat_locked}).eq("id",1);
    if(error)setStatus(error.message);else setStatus(!settings.chat_locked?"Chat wurde gesperrt.":"Chat wurde freigegeben.");
  }

  async function pinMessage(id:string|null){
    if(!profile?.is_admin)return;
    const next=settings.pinned_chat_message_id===id?null:id;
    const {error}=await supabase.from("event_settings").update({pinned_chat_message_id:next}).eq("id",1);
    if(error)setStatus(error.message);else setStatus(next?"Nachricht angepinnt.":"Anheftung entfernt.");
  }

  function toggleSelected(id:string){
    setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next});
  }

  const pinned=messages.find(message=>message.id===settings.pinned_chat_message_id);
  const lockedForUser=settings.chat_locked&&!profile?.is_admin;

  return <AuthGate><Shell>
    <div className="chat-page-shell">
      <div className="page-heading chat-heading">
        <span className="eyebrow">FIRESTARTER-GRUPPE</span><h1>Gruppenchat</h1><p>Wo seid ihr? Wer bestellt die nächste Runde?</p>
        {profile?.is_admin&&<div className="chat-admin-toolbar">
          <button type="button" onClick={toggleLock}>{settings.chat_locked?<><Unlock/>Freigeben</>:<><Lock/>Sperren</>}</button>
          <button type="button" className={selectionMode?"active":""} onClick={()=>{setSelectionMode(value=>!value);setSelected(new Set())}}>{selectionMode?<><X/>Auswahl beenden</>:<><CheckSquare/>Auswählen</>}</button>
          <button type="button" className="danger" onClick={clearChat}><Trash2/>Chat leeren</button>
        </div>}
      </div>
      {status&&<div className="chat-status">{status}</div>}
      {pinned&&<div className="pinned-message"><Pin/><div><span>Angepinnte Nachricht</span><strong>{pinned.profiles?.name||"Teilnehmer"}</strong><p>{pinned.body}</p></div>{profile?.is_admin&&<button onClick={()=>pinMessage(pinned.id)}><X/></button>}</div>}
      {settings.chat_locked&&<div className="chat-lock-notice"><Lock/>Der Chat ist aktuell {profile?.is_admin?"gesperrt – Admins können weiterhin schreiben.":"durch einen Admin gesperrt."}</div>}
      <div className="chat-list" ref={listRef}>{messages.map(m=>{
        const own=m.sender_id===profile?.id;
        const isSelected=selected.has(m.id);
        const messageReactions=reactions.filter(r=>r.message_id===m.id);
        const grouped=REACTIONS.map(emoji=>({emoji,items:messageReactions.filter(r=>r.emoji===emoji)})).filter(group=>group.items.length);
        return <div key={m.id} className={`message-row ${own?"own":""} ${isSelected?"selected":""}`} onClick={()=>selectionMode&&toggleSelected(m.id)}>
          {selectionMode&&<button type="button" className="message-select" aria-label="Nachricht auswählen">{isSelected?"✓":""}</button>}
          {!own&&<div className="avatar chat-avatar">{m.profiles?.avatar_url?<img src={m.profiles.avatar_url} alt=""/>:<span>{m.profiles?.name?.[0]||"?"}</span>}</div>}
          <div className={`${styles.messageWrap} ${own?styles.own:""}`}>
            <div className={`message ${own?"own":""}`}><strong>{own?"Du":m.profiles?.name}</strong>{m.image_url&&<img className="chat-image" src={m.image_url} alt="Chatfoto" loading="lazy" decoding="async"/>}{m.body&&m.body!=="📷 Foto"&&<p>{m.body}</p>}<small>{new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit"}).format(new Date(m.created_at))}</small>
              {profile?.is_admin&&!selectionMode&&<div className="message-admin-actions"><button type="button" title="Anpinnen" onClick={event=>{event.stopPropagation();pinMessage(m.id)}} className={settings.pinned_chat_message_id===m.id?"active":""}><Pin/></button><button type="button" title="Löschen" onClick={event=>{event.stopPropagation();removeMessages([m.id])}}><Trash2/></button></div>}
            </div>
            {!selectionMode&&<div className={styles.reactionBar} onClick={event=>event.stopPropagation()}>
              {grouped.map(group=><button key={group.emoji} type="button" className={`${styles.reactionChip} ${group.items.some(r=>r.user_id===profile?.id)?styles.mine:""}`} onClick={()=>react(m.id,group.emoji)}>{group.emoji}<span>{group.items.length}</span></button>)}
              <button type="button" className={styles.reactionAdd} aria-label="Reaktion hinzufügen" onClick={()=>setReactionOpen(current=>current===m.id?null:m.id)}><Smile size={15}/></button>
              {reactionOpen===m.id&&<div className={`${styles.reactionPicker} ${own?styles.own:""}`}>{REACTIONS.map(emoji=><button key={emoji} type="button" onClick={()=>react(m.id,emoji)}>{emoji}</button>)}</div>}
            </div>}
          </div>
        </div>})}</div>
      {selectionMode&&selected.size>0&&<div className="bulk-chat-actions"><strong>{selected.size} ausgewählt</strong><button onClick={()=>removeMessages(Array.from(selected))}><Trash2/>Auswahl löschen</button></div>}
      {emojiOpen&&<EmojiPicker onPick={emoji=>setText(t=>t+emoji)}/>} 
      <form className="chat-composer" onSubmit={send}><label className={`composer-image ${lockedForUser?"disabled":""}`}><ImagePlus/><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" capture="environment" onChange={sendImage} disabled={lockedForUser}/></label><button type="button" className="composer-emoji" onClick={()=>setEmojiOpen(v=>!v)} disabled={lockedForUser}><Smile/></button><input value={text} onChange={e=>setText(e.target.value)} placeholder={lockedForUser?"Chat ist aktuell gesperrt":uploading?(uploadStatus||"Foto wird vorbereitet …"):"Nachricht schreiben …"} autoComplete="off" disabled={uploading||lockedForUser}/><button aria-label="Senden" disabled={lockedForUser||uploading}><Send/></button></form>
    </div>
  </Shell></AuthGate>;
}
