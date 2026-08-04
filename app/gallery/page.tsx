"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Camera, Heart, Download, X, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Photo, PhotoComment } from "@/lib/types";

export default function GalleryPage() {
  const { profile } = useApp();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = createClient();
  const selected = photos.find(photo => photo.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setError("");
    const [photoResult, likeResult, commentResult] = await Promise.all([
      supabase.from("photos").select("*, profiles!photos_uploader_id_fkey(name,avatar_url)").order("created_at", { ascending: false }),
      supabase.from("photo_likes").select("photo_id,user_id"),
      supabase.from("photo_comments").select("id,photo_id,user_id,body,created_at,profiles!photo_comments_user_id_fkey(name,avatar_url)").order("created_at")
    ]);
    const firstError = photoResult.error || likeResult.error || commentResult.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const likes = likeResult.data ?? [];
    const comments = (commentResult.data ?? []) as unknown as PhotoComment[];
    setPhotos(((photoResult.data ?? []) as unknown as Photo[]).map(photo => ({ ...photo, photo_likes: likes.filter(like => like.photo_id === photo.id).map(like => ({ user_id: like.user_id })), photo_comments: comments.filter(comment => comment.photo_id === photo.id) })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); const channel = supabase.channel("gallery-v11").on("postgres_changes", { event: "*", schema: "public", table: "photos" }, load).on("postgres_changes", { event: "*", schema: "public", table: "photo_likes" }, load).on("postgres_changes", { event: "*", schema: "public", table: "photo_comments" }, load).subscribe(); return () => { supabase.removeChannel(channel); }; }, [load, supabase]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); if (!files.length || !profile) return;
    setBusy(true); setError(""); const failures: string[] = [];
    try { for (let index = 0; index < files.length; index += 1) { const file = files[index]; setUploadProgress(`Foto ${index + 1} von ${files.length} wird hochgeladen …`); try { const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-"); const path = `${profile.id}/${Date.now()}-${index}-${safeName}`; const { error: uploadError } = await supabase.storage.from("photos").upload(path, file, { upsert: false, cacheControl: "3600" }); if (uploadError) throw uploadError; const url = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl; const { error: insertError } = await supabase.from("photos").insert({ image_url: url, uploader_id: profile.id }); if (insertError) throw insertError; } catch (uploadError) { failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : "Fehler"}`); } } await load(); if (failures.length) setError(`${files.length - failures.length} von ${files.length} Fotos hochgeladen. ${failures.join(" | ")}`); } finally { setBusy(false); setUploadProgress(""); e.target.value = ""; }
  }

  async function removePhoto(photo: Photo) { if (!profile?.is_admin || !confirm("Foto wirklich löschen?")) return; const { error } = await supabase.from("photos").delete().eq("id", photo.id); if (error) setError(error.message); else { setSelectedId(null); await load(); } }
  async function toggleLike(photo: Photo) { if (!profile) return; const liked = photo.photo_likes?.some(like => like.user_id === profile.id); const result = liked ? await supabase.from("photo_likes").delete().eq("photo_id", photo.id).eq("user_id", profile.id) : await supabase.from("photo_likes").insert({ photo_id: photo.id, user_id: profile.id }); if (result.error) setError(result.error.message); else await load(); }
  async function comment(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!profile || !selected) return; const form = new FormData(e.currentTarget); const body = String(form.get("body")).trim(); if (!body) return; const { error: commentError } = await supabase.from("photo_comments").insert({ photo_id: selected.id, user_id: profile.id, body }); if (commentError) setError(commentError.message); else { e.currentTarget.reset(); await load(); } }

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">KEINE BEWEISE, KEIN VERBRECHEN</span><h1>Galerie</h1><p>Mehrere Fotos auswählen, liken, kommentieren und im Vollbild ansehen.</p></div>
    <div className="gallery-toolbar"><label className="upload-fab"><Camera />{busy ? uploadProgress || "Lädt …" : "Fotos hochladen"}<input type="file" accept="image/*" multiple onChange={upload} disabled={busy} /></label><button className="secondary-button" onClick={load} disabled={busy}><RefreshCw />Aktualisieren</button></div>
    {error && <div className="error">{error}</div>}
    {loading ? <div className="empty-card">Galerie wird geladen …</div> : !photos.length ? <div className="empty-card">Noch keine Fotos – lade das erste hoch.</div> : <div className="photo-grid">{photos.map(photo => { const liked = photo.photo_likes?.some(like => like.user_id === profile?.id); return <figure key={photo.id}><button className="photo-open" onClick={() => setSelectedId(photo.id)}><img src={photo.image_url} alt="Tourfoto" loading="lazy" /></button>{profile?.is_admin&&<button className="admin-overlay-delete" onClick={()=>removePhoto(photo)} title="Foto löschen"><Trash2/></button>}<figcaption><span>{photo.profiles?.name || "Mitglied"}<small>{new Date(photo.created_at).toLocaleString("de-DE")}</small></span><div><button className={liked ? "liked" : ""} onClick={() => toggleLike(photo)}><Heart fill={liked ? "currentColor" : "none"} />{photo.photo_likes?.length || 0}</button><button onClick={() => setSelectedId(photo.id)}><MessageCircle />{photo.photo_comments?.length || 0}</button></div></figcaption></figure>; })}</div>}
    {selected && <div className="photo-modal" onClick={() => setSelectedId(null)}><div className="photo-modal-card" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedId(null)}><X /></button><img src={selected.image_url} alt="Tourfoto" /><div className="modal-actions"><button onClick={() => toggleLike(selected)}><Heart />Gefällt {selected.photo_likes?.length || 0}</button><a href={selected.image_url} target="_blank" rel="noreferrer"><Download />Öffnen / Download</a>{profile?.is_admin&&<button className="danger-button" onClick={()=>removePhoto(selected)}><Trash2/>Foto löschen</button>}</div><div className="comments">{selected.photo_comments?.map(commentItem => <div key={commentItem.id}><strong>{commentItem.profiles?.name || "Mitglied"}</strong><p>{commentItem.body}</p></div>)}</div><form onSubmit={comment}><input name="body" placeholder="Kommentar schreiben …" /><button className="primary-button">Senden</button></form></div></div>}
  </Shell></AuthGate>;
}
