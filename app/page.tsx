"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { Countdown } from "@/components/countdown";
import { LocationSharing } from "@/components/location-sharing";
import { PushEnable } from "@/components/push-enable";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { NewsItem, MapPin, Photo, EventSettings } from "@/lib/types";
import { CalendarClock, MapPin as PinIcon, Bell, Users, Images, MessageCircle, ChevronRight } from "lucide-react";

export default function HomePage() {
  const { profile } = useApp();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [nextPin, setNextPin] = useState<MapPin | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase.from("event_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("news").select("*, profiles(name,avatar_url)").order("created_at", { ascending: false }).limit(4),
      supabase.from("map_pins").select("*").gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
      supabase.from("photos").select("*, profiles(name,avatar_url)").order("created_at", { ascending: false }).limit(6),
      supabase.from("profiles").select("*", { count: "exact", head: true })
    ]).then(([eventResult, newsResult, pinResult, photoResult, memberResult]) => {
      setEvent(eventResult.data);
      setNews((newsResult.data as NewsItem[]) ?? []);
      setNextPin(pinResult.data);
      setPhotos((photoResult.data as Photo[]) ?? []);
      setMemberCount(memberResult.count ?? 0);
    });
  }, []);

  const hero = event?.hero_image_url || "/brand/logo.jpeg";

  return (
    <AuthGate><Shell>
      <section className="hero premium-hero" style={{ backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.97)),url("${hero}")` }}>
        <div className="hero-fire-glow" />
        <div className="hero-overlay">
          <span className="eyebrow">DER COUNTDOWN LÄUFT</span>
          <h1>{event?.title || "Bachelortour 2026"}</h1>
          <p>{event?.subtitle || `Willkommen, ${profile?.name?.split(" ")[0] ?? "Jungs"} – das wird legendär.`}</p>
          <Countdown startsAt={event?.starts_at}/>
          <div className="hero-actions">
            <LocationSharing />
            <PushEnable />
          </div>
        </div>
      </section>

      <section className="quick-stats">
        <Link href="/members"><Users/><strong>{memberCount}</strong><span>Jungs</span></Link>
        <Link href="/gallery"><Images/><strong>{photos.length}+</strong><span>Neue Fotos</span></Link>
        <Link href="/chat"><MessageCircle/><strong>Live</strong><span>Gruppenchat</span></Link>
      </section>

      <section className="section">
        <div className="section-title"><Bell size={20}/><h2>Neuigkeiten</h2></div>
        <div className="news-stack">
          {news.length ? news.map(item => (
            <article className="news-card" key={item.id}>
              {item.image_url && <img src={item.image_url} alt=""/>}
              <div className="news-content">
                <div className="news-meta">
                  <span>{item.profiles?.name || "Admin"}</span>
                  <small>{new Date(item.created_at).toLocaleString("de-DE", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small>
                </div>
                <h3>{item.title}</h3><p>{item.body}</p>
              </div>
            </article>
          )) : <div className="empty-card">Noch keine Neuigkeiten – die Ruhe vor dem Sturm.</div>}
        </div>
      </section>

      <section className="section">
        <div className="section-title"><CalendarClock size={20}/><h2>Nächster Programmpunkt</h2></div>
        {nextPin ? <article className="next-event-card">
          <div className="event-time">{nextPin.starts_at ? new Date(nextPin.starts_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
          <div className="event-copy"><h3>{nextPin.title}</h3><p>{nextPin.description}</p><small>{nextPin.starts_at ? new Date(nextPin.starts_at).toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long"}) : ""}</small></div>
          <a className="round-action" href={`https://www.google.com/maps/dir/?api=1&destination=${nextPin.latitude},${nextPin.longitude}`} target="_blank"><PinIcon/></a>
        </article> : <div className="empty-card">Noch kein Termin eingetragen.</div>}
      </section>

      <section className="section">
        <div className="section-title"><Images size={20}/><h2>Frische Beweise</h2><Link className="section-link" href="/gallery">Alle <ChevronRight size={17}/></Link></div>
        <div className="home-photo-strip">
          {photos.map(photo => <img key={photo.id} src={photo.image_url} alt="Tourfoto" loading="lazy"/>)}
          {!photos.length && <div className="empty-card">Noch keine Fotos hochgeladen.</div>}
        </div>
      </section>
    </Shell></AuthGate>
  );
}
