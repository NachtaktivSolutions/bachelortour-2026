"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ListMusic, LoaderCircle, Plus, RefreshCw, Search, ThumbsUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type SearchTrack={id:string;uri:string;title:string;artist:string;album:string;image:string|null;durationMs:number;externalUrl:string|null};
type QueueTrack={id:string;spotify_id:string;spotify_uri:string;title:string;artist:string;album:string|null;image_url:string|null;duration_ms:number|null;requested_by:string;requested_at:string;status:"queued"|"sent"|"playing"|"played"|"removed";sent_at:string|null};
type Vote={track_id:string;user_id:string};
type Current={id:string;uri:string;title:string;artist:string;image:string|null;progressMs:number;durationMs:number;isPlaying:boolean;device:{id:string;name:string}|null};

export function ParticipantJukeboxCard(){
  const {profile,actualIsAdmin,adminPreview}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [mounted,setMounted]=useState(false);
  const [open,setOpen]=useState(false);
  const [current,setCurrent]=useState<Current|null>(null);
  const [connected,setConnected]=useState(false);
  const [tracks,setTracks]=useState<QueueTrack[]>([]);
  const [votes,setVotes]=useState<Vote[]>([]);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchTrack[]>([]);
  const [searching,setSearching]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [message,setMessage]=useState("");

  const preview=actualIsAdmin&&adminPreview;

  const authHeader=useCallback(async()=>{
    const {data}=await supabase.auth.getSession();
    const token=data.session?.access_token;
    if(!token)throw new Error("Nicht angemeldet.");
    return {Authorization:`Bearer ${token}`};
  },[supabase]);

  const loadPlayer=useCallback(async()=>{
    if(!profile)return;
    try{
      const res=await fetch("/api/spotify/player",{headers:await authHeader(),cache:"no-store"});
      const data=await res.json();
      setConnected(Boolean(data.connected));
      setCurrent(data.current??null);
    }catch{
      setConnected(false);
      setCurrent(null);
    }
  },[profile,authHeader]);

  const loadQueue=useCallback(async()=>{
    if(!profile)return;
    const [t,v]=await Promise.all([
      supabase.from("jukebox_tracks").select("*").in("status",["queued","sent","playing"]).order("requested_at"),
      supabase.from("jukebox_votes").select("track_id,user_id")
    ]);
    setTracks((t.data as QueueTrack[])??[]);
    setVotes((v.data as Vote[])??[]);
  },[profile,supabase]);

  useEffect(()=>{setMounted(true)},[]);
  useEffect(()=>{
    if(!profile||profile.is_admin)return;
    void loadPlayer();void loadQueue();
    const channel=supabase.channel("jukebox-participant-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"jukebox_tracks"},()=>void loadQueue())
      .on("postgres_changes",{event:"*",schema:"public",table:"jukebox_votes"},()=>void loadQueue())
      .subscribe();
    const timer=window.setInterval(()=>void loadPlayer(),5000);
    return()=>{window.clearInterval(timer);void supabase.removeChannel(channel)};
  },[profile,loadPlayer,loadQueue,supabase]);

  useEffect(()=>{
    if(!open||!mounted)return;
    const y=window.scrollY;
    const body=document.body;
    const old={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};
    body.style.position="fixed";body.style.top=`-${y}px`;body.style.width="100%";body.style.overflow="hidden";
    return()=>{body.style.position=old.position;body.style.top=old.top;body.style.width=old.width;body.style.overflow=old.overflow;window.scrollTo(0,y)};
  },[open,mounted]);

  useEffect(()=>{
    if(!open||!connected)return;
    const q=query.trim();
    if(q.length<3){setResults([]);setSearchOpen(false);setSearching(false);return}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setSearching(true);setSearchOpen(true);
      try{
        const res=await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`,{headers:await authHeader(),cache:"no-store",signal:controller.signal});
        const data=await res.json();
        if(!res.ok)throw new Error(data.error||"Suche fehlgeschlagen.");
        setResults(data.tracks??[]);
      }catch(e){if((e as Error).name!=="AbortError")setMessage(e instanceof Error?e.message:"Spotify-Suche fehlgeschlagen.")}
      finally{if(!controller.signal.aborted)setSearching(false)}
    },280);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[query,open,connected,authHeader]);

  const ranked=useMemo(()=>[...tracks].sort((a,b)=>{
    const av=votes.filter(v=>v.track_id===a.id).length;
    const bv=votes.filter(v=>v.track_id===b.id).length;
    return bv-av||new Date(a.requested_at).getTime()-new Date(b.requested_at).getTime();
  }),[tracks,votes]);

  if(!profile||profile.is_admin)return null;
  const visible=preview?Boolean(current):Boolean(current?.isPlaying);
  if(!visible)return null;

  async function search(e:FormEvent){e.preventDefault();if(query.trim().length<3)return;setSearchOpen(true)}
  async function addTrack(track:SearchTrack){
    if(!profile)return;
    const {data,error}=await supabase.from("jukebox_tracks").insert({spotify_id:track.id,spotify_uri:track.uri,title:track.title,artist:track.artist,album:track.album,image_url:track.image,duration_ms:track.durationMs,requested_by:profile.id,status:"queued"}).select("id").single();
    if(error){setMessage(error.message);return}
    await supabase.from("jukebox_votes").insert({track_id:data.id,user_id:profile.id});
    setQuery("");setResults([]);setSearchOpen(false);setMessage(`${track.title} ist in der Jukebox.`);await loadQueue();
  }
  async function toggleVote(trackId:string){
    if(!profile)return;
    const track=tracks.find(t=>t.id===trackId);if(track?.status!=="queued")return;
    const mine=votes.some(v=>v.track_id===trackId&&v.user_id===profile.id);
    if(mine)await supabase.from("jukebox_votes").delete().eq("track_id",trackId).eq("user_id",profile.id);
    else await supabase.from("jukebox_votes").insert({track_id:trackId,user_id:profile.id});
    await loadQueue();
  }

  const queuedCount=ranked.filter(t=>t.status==="queued").length;
  const waiting=ranked.filter(t=>t.status==="queued"||t.status==="sent");

  const compact=<button id="jukebox" onClick={()=>setOpen(true)} style={{width:"100%",marginTop:14,border:"1px solid #285b3d",borderRadius:20,background:"linear-gradient(145deg,#142219,#0c0f0d)",color:"#fff",padding:12,display:"grid",gridTemplateColumns:"52px 1fr auto",gap:12,alignItems:"center",textAlign:"left"}}>
    {current?.image?<img src={current.image} alt="" style={{width:52,height:52,borderRadius:12,objectFit:"cover"}}/>:<span style={{width:52,height:52,borderRadius:12,display:"grid",placeItems:"center",background:"#1DB954",color:"#07150b"}}><ListMusic/></span>}
    <span style={{minWidth:0}}><span className="eyebrow" style={{color:"#4fe27f",fontSize:10}}>BACHELOR JUKEBOX</span><strong style={{display:"block",fontSize:"1rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2}}>{current?.title||"Jukebox"}</strong><small style={{display:"block",color:"#9faaa3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current?`${current.artist} · ${queuedCount} offene Wünsche`:""}</small></span>
    <ChevronRight size={24} color="#57df83"/>
  </button>;

  const modal=open&&mounted?createPortal(<div style={{position:"fixed",inset:0,zIndex:100000,background:"rgba(0,0,0,.86)",display:"grid",placeItems:"center",padding:"calc(env(safe-area-inset-top) + 10px) 8px calc(env(safe-area-inset-bottom) + 10px)"}} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <section role="dialog" aria-modal="true" style={{width:"min(760px,100%)",maxHeight:"calc(100dvh - 24px)",border:"1px solid #285b3d",borderRadius:24,background:"linear-gradient(155deg,#142219,#090b0a 44%)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <header style={{padding:16,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.08)"}}><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:42,height:42,borderRadius:13,display:"grid",placeItems:"center",background:"#1DB954",color:"#07150b"}}><ListMusic/></span><div><span className="eyebrow" style={{color:"#4fe27f"}}>JUKEBOX · SPOTIFY</span><h2 style={{margin:0,fontSize:"1.2rem"}}>Bachelor Jukebox</h2></div></div><div style={{display:"flex",gap:7}}><button className="icon-button" onClick={()=>{void loadPlayer();void loadQueue()}}><RefreshCw size={18}/></button><button className="icon-button" onClick={()=>setOpen(false)}><X size={20}/></button></div></header>
      <div style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",padding:16,display:"grid",gap:14}}>
        {current&&<div style={{display:"grid",gridTemplateColumns:"58px 1fr",gap:12,alignItems:"center",padding:12,borderRadius:18,background:"rgba(29,185,84,.1)",border:"1px solid rgba(29,185,84,.25)"}}>{current.image?<img src={current.image} alt="" style={{width:58,height:58,borderRadius:12,objectFit:"cover"}}/>:<div/>}<div style={{minWidth:0}}><span style={{fontSize:11,color:"#4fe27f",fontWeight:800}}>{current.isPlaying?"JETZT LÄUFT":"PAUSIERT"}</span><strong style={{display:"block",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current.title}</strong><small style={{color:"#aaa"}}>{current.artist}</small></div></div>}
        <div style={{position:"relative",zIndex:20}}><form onSubmit={search} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}><input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>{if(query.trim().length>=3)setSearchOpen(true)}} placeholder="Song oder Interpret suchen …" autoComplete="off"/><button className="primary-button" disabled={query.trim().length<3||searching}>{searching?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}</button></form>{searchOpen&&query.trim().length>=3&&<div style={{position:"absolute",left:0,right:0,top:"calc(100% + 7px)",maxHeight:300,overflowY:"auto",border:"1px solid #333",borderRadius:14,background:"#111",zIndex:50}}>{results.length?results.map(t=><button key={t.id} type="button" onClick={()=>void addTrack(t)} style={{width:"100%",border:0,borderBottom:"1px solid #222",background:"transparent",color:"#fff",display:"grid",gridTemplateColumns:"46px 1fr auto",gap:10,alignItems:"center",padding:9,textAlign:"left"}}>{t.image?<img src={t.image} alt="" style={{width:46,height:46,borderRadius:8,objectFit:"cover"}}/>:<div/>}<span style={{minWidth:0}}><strong style={{display:"block",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</strong><small style={{color:"#999"}}>{t.artist}</small></span><Plus size={19} color="#4fe27f"/></button>):!searching?<div style={{padding:14,color:"#888"}}>Keine passenden Songs gefunden.</div>:null}</div>}</div>
        <div><div style={{marginBottom:8}}><strong>Warteschlange & Voting</strong><small style={{display:"block",color:"#8b938f",marginTop:2}}>{queuedCount} offene Songwünsche</small></div>{waiting.length===0?<div className="empty-card">Noch keine Songwünsche.</div>:<div style={{maxHeight:"40dvh",overflowY:"auto",WebkitOverflowScrolling:"touch",display:"grid",gap:7}}>{waiting.map((t,index)=>{const count=votes.filter(v=>v.track_id===t.id).length;const mine=votes.some(v=>v.track_id===t.id&&v.user_id===profile.id);const locked=t.status!=="queued";return <div key={t.id} style={{display:"grid",gridTemplateColumns:"30px 44px 1fr auto",gap:8,alignItems:"center",padding:9,borderRadius:14,background:locked?"rgba(29,185,84,.10)":"#151515"}}><strong style={{textAlign:"center",color:index===0?"#4fe27f":"#777"}}>{index+1}</strong>{t.image_url?<img src={t.image_url} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover"}}/>:<div/>}<div style={{minWidth:0}}><strong style={{display:"block",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</strong><small style={{color:"#999"}}>{t.artist}{t.status==="sent"?" · als Nächstes":""}</small></div><button disabled={locked} onClick={()=>void toggleVote(t.id)} style={{border:0,borderRadius:999,padding:"9px 11px",display:"flex",gap:6,alignItems:"center",background:mine?"#1DB954":"#252525",color:mine?"#07150b":"#fff",fontWeight:900,opacity:locked?.55:1}}><ThumbsUp size={15}/>{count}</button></div>})}</div>}</div>
        {message&&<div className="status" style={{margin:0}}>{message}</div>}
      </div>
    </section>
  </div>,document.body):null;

  return <>{compact}{modal}</>;
}
