"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { Countdown } from "@/components/countdown";
import { LocationSharing } from "@/components/location-sharing";
import { WeatherCard } from "@/components/weather-card";
import { SpotifyCard } from "@/components/spotify-card";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { NewsItem, Photo, EventSettings, ProgramItem } from "@/lib/types";
import { CalendarClock, Navigation, Bell, Users, Images, MessageCircle, ChevronRight, Trash2, Building2, Info, Phone, ExternalLink } from "lucide-react";

type Hotel={id:string;name:string;address:string;description:string|null};
type Knowledge={id:string;category:string;title:string;description:string|null;address:string|null;phone:string|null;url:string|null};

export default function HomePage() {
  const { profile } = useApp();
  const [news,setNews]=useState<NewsItem[]>([]);
  const [nextItem,setNextItem]=useState<ProgramItem|null>(null);
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [event,setEvent]=useState<EventSettings|null>(null);
  const [memberCount,setMemberCount]=useState(0);
  const [hotels,setHotels]=useState<Hotel[]>([]);
  const [knowledge,setKnowledge]=useState<Knowledge[]>([]);
  const [status,setStatus]=useState("");
  const supabase=createClient();

  const loadPhotos=useCallback(async()=>{const {data}=await supabase.from("photos").select("*, profiles!photos_uploader_id_fkey(name,avatar_url)").order("created_at",{ascending:false}).limit(5);setPhotos((data as unknown as Photo[])??[])},[supabase]);
  const loadPage=useCallback(async()=>{
    const [eventResult,newsResult,programResult,memberResult,hotelResult,knowledgeResult]=await Promise.all([
      supabase.from("event_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("news").select("*, profiles(name,avatar_url)").order("created_at",{ascending:false}).limit(4),
      supabase.from("program_items").select("*").eq("is_visible",true).gte("starts_at",new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
      supabase.from("profiles").select("*",{count:"exact",head:true}),
      supabase.from("hotels").select("*").eq("is_visible",true).order("sort_order").order("created_at"),
      supabase.from("knowledge_items").select("*").eq("is_visible",true).order("sort_order").order("category").order("created_at")
    ]);
    setEvent(eventResult.data);setNews((newsResult.data as NewsItem[])??[]);setNextItem(programResult.data);setMemberCount(memberResult.count??0);setHotels(hotelResult.data??[]);setKnowledge(knowledgeResult.data??[]);await loadPhotos();
  },[loadPhotos,supabase]);

  useEffect(()=>{
    loadPage();
    const channel=supabase.channel("home-v33")
      .on("postgres_changes",{event:"*",schema:"public",table:"photos"},loadPhotos)
      .on("postgres_changes",{event:"*",schema:"public",table:"news"},loadPage)
      .on("postgres_changes",{event:"*",schema:"public",table:"program_items"},loadPage)
      .on("postgres_changes",{event:"*",schema:"public",table:"hotels"},loadPage)
      .on("postgres_changes",{event:"*",schema:"public",table:"knowledge_items"},loadPage).subscribe();
    const refreshOnFocus=()=>loadPage();window.addEventListener("focus",refreshOnFocus);
    return()=>{window.removeEventListener("focus",refreshOnFocus);supabase.removeChannel(channel)};
  },[loadPage,loadPhotos,supabase]);

  async function removeNews(id:string){if(!profile?.is_admin||!confirm("Neuigkeit wirklich löschen?"))return;const {error}=await supabase.from("news").delete().eq("id",id);setStatus(error?error.message:"Neuigkeit gelöscht.");await loadPage()}
  async function removeProgram(id:string){if(!profile?.is_admin||!confirm("Programmpunkt wirklich löschen?"))return;const {error}=await supabase.from("program_items").delete().eq("id",id);setStatus(error?error.message:"Programmpunkt gelöscht.");await loadPage()}

  const hero=event?.hero_image_url||"/brand/logo.jpeg";
  const lat=event?.weather_latitude||48.6778281; const lon=event?.weather_longitude||9.21833;

  return <AuthGate><Shell>
    {status&&<div className="status floating-status">{status}</div>}
    {hotels.length>0&&<section className="released-hotels"><div className="section-title"><Building2 size={20}/><h2>Unser Hotel</h2></div><div className="hotel-strip">{hotels.map(hotel=><article className="hotel-card" key={hotel.id}><div><span className="eyebrow">UNTERKUNFT</span><h3>{hotel.name}</h3>{hotel.description&&<p>{hotel.description}</p>}<small>{hotel.address}</small></div><a className="round-action compact-round-action" aria-label={`Navigation zu ${hotel.name}`} title="Navigation starten" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotel.address)}`}><Navigation/></a></article>)}</div></section>}
    <section className="hero premium-hero hero-v10" style={{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.95)),url("${hero}")`}}><div className="hero-fire-glow"/><div className="hero-overlay"><span className="eyebrow">DER COUNTDOWN LÄUFT</span><h1>{event?.title||"Bachelortour 2026"}</h1><p>{event?.subtitle||`Willkommen, ${profile?.name?.split(" ")[0]??"Bachelor"} – das wird legendär.`}</p><Countdown startsAt={event?.starts_at}/><div className="hero-actions"><LocationSharing/></div></div></section>
    <section className="quick-stats quick-stats-v10"><Link href="/members"><Users/><strong>{memberCount}</strong><span>Bachelor</span></Link><Link href="/gallery"><Images/><strong>{photos.length}</strong><span>Neueste Fotos</span></Link><Link href="/chat"><MessageCircle/><strong>Live</strong><span>Gruppenchat</span></Link></section>
    <WeatherCard latitude={lat} longitude={lon}/><SpotifyCard url={event?.spotify_url}/>
    <section className="section"><div className="section-title"><CalendarClock size={20}/><h2>Nächster Programmpunkt</h2><Link className="section-link" href="/program">Ganzer Plan <ChevronRight size={17}/></Link></div>{nextItem?<article className="next-event-card"><div className="event-time">{new Date(nextItem.starts_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"})}</div><div className="event-copy"><h3>{nextItem.title}</h3><p>{nextItem.description}</p><small>{nextItem.address}</small></div>{nextItem.address&&<a className="round-action" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextItem.address)}`} target="_blank"><Navigation/></a>}{profile?.is_admin&&<button className="round-action danger-icon" onClick={()=>removeProgram(nextItem.id)}><Trash2/></button>}</article>:<div className="empty-card">Noch kein Programmpunkt bekanntgegeben.</div>}</section>
    <section className="section"><div className="section-title"><Bell size={20}/><h2>Neuigkeiten</h2></div><div className="news-stack">{news.length?news.map(item=><article className="news-card" key={item.id}>{item.image_url&&<img src={item.image_url} alt=""/>}<div className="news-content"><div className="news-meta"><span>{item.profiles?.name||"Admin"}</span><small>{new Date(item.created_at).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"})}</small></div><h3>{item.title}</h3><p>{item.body}</p></div>{profile?.is_admin&&<button className="admin-overlay-delete news-delete" onClick={()=>removeNews(item.id)}><Trash2/></button>}</article>):<div className="empty-card">Noch keine Neuigkeiten – die Ruhe vor dem Sturm.</div>}</div></section>
    {knowledge.length>0&&<section className="section knowledge-section"><div className="section-title"><Info size={20}/><h2>Wissenswertes</h2></div><div className="knowledge-grid">{knowledge.map(item=><article className="knowledge-card" key={item.id}><span className="eyebrow">{item.category.toUpperCase()}</span><h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}{item.address&&<small>{item.address}</small>}<div className="knowledge-actions icon-only-actions">{item.phone&&<a aria-label={`${item.title} anrufen`} title="Anrufen" href={`tel:${item.phone}`}><Phone/></a>}{item.address&&<a aria-label={`Navigation zu ${item.title}`} title="Navigation starten" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}><Navigation/></a>}{item.url&&<a aria-label={`${item.title} öffnen`} title="Website öffnen" target="_blank" rel="noreferrer" href={item.url}><ExternalLink/></a>}</div></article>)}</div></section>}
    <section className="section"><div className="section-title"><Images size={20}/><h2>Frische Beweise</h2><Link className="section-link" href="/gallery">Alle <ChevronRight size={17}/></Link></div><div className="home-photo-masonry">{photos.map((photo,index)=><Link href="/gallery" className={`home-proof proof-${index+1}`} key={photo.id}><img src={photo.image_url} alt="Tourfoto" loading="lazy"/></Link>)}{!photos.length&&<div className="empty-card">Noch keine Fotos hochgeladen.</div>}</div></section>
  </Shell></AuthGate>;
}
