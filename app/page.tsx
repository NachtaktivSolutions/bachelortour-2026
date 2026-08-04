"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { Countdown } from "@/components/countdown";
import { LocationSharing } from "@/components/location-sharing";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { NewsItem, MapPin } from "@/lib/types";
import { CalendarClock, MapPin as PinIcon, Bell } from "lucide-react";

export default function HomePage() {
  const { profile } = useApp();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [nextPin, setNextPin] = useState<MapPin | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.from("news").select("*").order("created_at", { ascending: false }).limit(5).then(({data}) => setNews(data ?? []));
    supabase.from("map_pins").select("*").gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle().then(({data}) => setNextPin(data));
  }, []);

  return (
    <AuthGate><Shell>
      <section className="hero">
        <div className="hero-overlay">
          <span className="eyebrow">DER COUNTDOWN LÄUFT</span>
          <h1>Hallo, {profile?.name?.split(" ")[0] ?? "Jungs"} 👋</h1>
          <p>Alles für unsere Bachelortour an einem Ort.</p>
          <Countdown />
          <LocationSharing />
        </div>
      </section>

      <section className="section">
        <div className="section-title"><Bell size={20}/><h2>Neuigkeiten</h2></div>
        <div className="card-list">
          {news.length ? news.map(item => (
            <article className="card" key={item.id}>
              {item.image_url && <img className="card-image" src={item.image_url} alt=""/>}
              <div><small>{new Date(item.created_at).toLocaleString("de-DE")}</small><h3>{item.title}</h3><p>{item.body}</p></div>
            </article>
          )) : <div className="empty-card">Noch keine Neuigkeiten.</div>}
        </div>
      </section>

      <section className="section">
        <div className="section-title"><CalendarClock size={20}/><h2>Nächster Termin</h2></div>
        {nextPin ? <article className="card meeting-card">
          <PinIcon/><div><h3>{nextPin.title}</h3><p>{nextPin.description}</p><small>{nextPin.starts_at ? new Date(nextPin.starts_at).toLocaleString("de-DE") : ""}</small></div>
          <a className="secondary-button" href={`https://www.google.com/maps/dir/?api=1&destination=${nextPin.latitude},${nextPin.longitude}`} target="_blank">Navigation</a>
        </article> : <div className="empty-card">Noch kein Termin eingetragen.</div>}
      </section>
    </Shell></AuthGate>
  );
}
