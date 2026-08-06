"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CarFront, MapPin, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

type RideKind = "offer" | "need";
type RideSignup = { user_id: string; profiles?: { name?: string | null } | null };
type RidePost = {
  id: string;
  creator_id: string;
  kind: RideKind;
  origin: string;
  destination: string;
  seats: number;
  created_at: string;
  profiles?: { name?: string | null } | null;
  rideshare_signups?: RideSignup[];
};

export function RideshareBoard() {
  const { profile } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<RidePost[]>([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RideKind>("offer");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("rideshare_posts")
      .select("*, profiles!rideshare_posts_creator_id_fkey(name), rideshare_signups(user_id, profiles!rideshare_signups_user_id_fkey(name))")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!error) setPosts((data as unknown as RidePost[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("rideshare-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "rideshare_posts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rideshare_signups" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  async function createPost() {
    if (!profile?.id || !origin.trim() || !destination.trim()) {
      setStatus("Von und nach fehlt noch.");
      return;
    }
    setBusy("create");
    const { error } = await supabase.from("rideshare_posts").insert({
      creator_id: profile.id,
      kind,
      origin: origin.trim(),
      destination: destination.trim(),
      seats
    });
    setBusy(null);
    if (error) { setStatus(error.message); return; }
    setOrigin(""); setDestination(""); setSeats(1); setOpen(false); setStatus("Fahrt gepostet.");
    await load();
  }

  async function toggleSignup(post: RidePost) {
    if (!profile?.id) return;
    const joined = post.rideshare_signups?.some(s => s.user_id === profile.id);
    setBusy(post.id);
    if (joined) {
      const { error } = await supabase.from("rideshare_signups").delete().eq("post_id", post.id).eq("user_id", profile.id);
      if (error) setStatus(error.message);
    } else {
      const { data, error } = await supabase.rpc("join_rideshare_post", { target_post_id: post.id });
      if (error) setStatus(error.message);
      else if (data === false) setStatus("Leider gerade voll – da war jemand eine Sekunde schneller.");
    }
    setBusy(null);
    await load();
  }

  async function remove(post: RidePost) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    setBusy(post.id);
    const { error } = await supabase.from("rideshare_posts").delete().eq("id", post.id);
    setBusy(null);
    if (error) setStatus(error.message);
    await load();
  }

  return <section className="section rideshare-section" id="rideshare">
    <div className="section-title rideshare-title">
      <CarFront size={20}/><h2>Mitfahr-Pinnwand</h2>
      <button className="rideshare-add" type="button" onClick={() => setOpen(true)}><Plus size={17}/> Fahrt</button>
    </div>
    {status && <div className="rideshare-status" onClick={() => setStatus("")}>{status}</div>}
    <div className="rideshare-list">
      {posts.map(post => {
        const signups = post.rideshare_signups ?? [];
        const joined = signups.some(s => s.user_id === profile?.id);
        const remaining = Math.max(0, post.seats - signups.length);
        const full = remaining === 0;
        const canDelete = post.creator_id === profile?.id || Boolean(profile?.is_admin);
        return <article className="rideshare-card" key={post.id}>
          <div className={`rideshare-kind ${post.kind}`}>
            {post.kind === "offer" ? <CarFront size={15}/> : <Search size={15}/>} {post.kind === "offer" ? "Biete" : "Suche"}
          </div>
          <div className="rideshare-route">
            <strong>{post.origin}</strong><span>→</span><strong>{post.destination}</strong>
            <small><MapPin size={12}/>{post.profiles?.name || "Bachelor"}</small>
          </div>
          <div className="rideshare-capacity">
            <span><Users size={15}/><b>{remaining}</b> frei</span>
            <div className="rideshare-avatars" title={signups.map(s => s.profiles?.name).filter(Boolean).join(", ")}>
              {signups.slice(0,3).map(s => <i key={s.user_id}>{(s.profiles?.name || "?").trim().charAt(0).toUpperCase()}</i>)}
            </div>
          </div>
          <div className="rideshare-actions">
            <button type="button" disabled={busy === post.id || (full && !joined)} className={joined ? "joined" : ""} onClick={() => toggleSignup(post)}>
              {joined ? <><X size={15}/> Austragen</> : <><UserPlus size={15}/>{full ? "Voll" : "Eintragen"}</>}
            </button>
            {canDelete && <button type="button" className="rideshare-delete" aria-label="Eintrag löschen" onClick={() => remove(post)}><Trash2 size={15}/></button>}
          </div>
        </article>;
      })}
      {!posts.length && <div className="empty-card rideshare-empty">Noch keine Fahrten – der Parkplatz ist verdächtig ruhig.</div>}
    </div>

    {open && <div className="modal-backdrop rideshare-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal-card rideshare-modal" role="dialog" aria-modal="true" aria-label="Fahrt erstellen">
        <div className="rideshare-modal-head"><div><span className="eyebrow">MITFAHR-PINNWAND</span><h3>Fahrt posten</h3></div><button type="button" onClick={() => setOpen(false)}><X/></button></div>
        <div className="rideshare-kind-switch">
          <button className={kind === "offer" ? "active" : ""} onClick={() => setKind("offer")}><CarFront size={17}/> Ich biete</button>
          <button className={kind === "need" ? "active" : ""} onClick={() => setKind("need")}><Search size={17}/> Ich suche</button>
        </div>
        <label>Von<input value={origin} maxLength={120} onChange={e => setOrigin(e.target.value)} placeholder="z. B. Esslingen"/></label>
        <label>Nach<input value={destination} maxLength={120} onChange={e => setDestination(e.target.value)} placeholder="z. B. Flughafen Stuttgart"/></label>
        <label>Verfügbare Plätze<input type="number" min={1} max={20} value={seats} onChange={e => setSeats(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}/></label>
        <button className="primary-button rideshare-submit" type="button" disabled={busy === "create"} onClick={createPost}>{busy === "create" ? "Wird gepostet …" : "Auf Pinnwand setzen"}</button>
      </div>
    </div>}
  </section>;
}
