"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Camera, Heart } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types";

export default function GalleryPage() {
  const {profile}=useApp(); const [photos,setPhotos]=useState<Photo[]>([]); const [busy,setBusy]=useState(false); const supabase=createClient();
  const load=()=>supabase.from("photos").select("*, profiles(name,avatar_url), photo_likes(user_id)").order("created_at",{ascending:false}).then(({data})=>setPhotos((data as Photo[])??[]));
  useEffect(()=>{load()},[]);
  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file||!profile)return; setBusy(true);
    const path=`${profile.id}/${Date.now()}-${file.name.replace(/\s+/g,"-")}`;
    const up=await supabase.storage.from("photos").upload(path,file);
    if(!up.error){
      const url=supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      await supabase.from("photos").insert({image_url:url,uploader_id:profile.id});
      await load();
    }
    setBusy(false); e.target.value="";
  }
  async function toggleLike(photo:Photo){
    if(!profile)return;
    const liked=photo.photo_likes?.some(l=>l.user_id===profile.id);
    if(liked) await supabase.from("photo_likes").delete().eq("photo_id",photo.id).eq("user_id",profile.id);
    else await supabase.from("photo_likes").insert({photo_id:photo.id,user_id:profile.id});
    await load();
  }
  return <AuthGate><Shell><div className="page-heading"><span className="eyebrow">KEINE BEWEISE, KEIN VERBRECHEN</span><h1>Galerie</h1><p>Die besten, schlimmsten und verschwommensten Momente.</p></div>
    <label className="upload-fab"><Camera/>{busy?"Lädt …":"Foto hochladen"}<input type="file" accept="image/*" capture="environment" onChange={upload}/></label>
    <div className="photo-grid">{photos.map(p=>{
      const liked=p.photo_likes?.some(l=>l.user_id===profile?.id);
      return <figure key={p.id}><img src={p.image_url} alt="Tourfoto" loading="lazy"/><figcaption><span>{p.profiles?.name}<small>{new Date(p.created_at).toLocaleString("de-DE")}</small></span><button className={liked?"liked":""} onClick={()=>toggleLike(p)}><Heart fill={liked?"currentColor":"none"}/>{p.photo_likes?.length||0}</button></figcaption></figure>
    })}</div>
  </Shell></AuthGate>;
}
