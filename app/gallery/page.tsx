"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types";

export default function GalleryPage() {
  const {profile}=useApp(); const [photos,setPhotos]=useState<Photo[]>([]); const [busy,setBusy]=useState(false); const supabase=createClient();
  const load=()=>supabase.from("photos").select("*, profiles(name,avatar_url)").order("created_at",{ascending:false}).then(({data})=>setPhotos((data as Photo[])??[]));
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
  return <AuthGate><Shell><div className="page-heading"><h1>Galerie</h1><p>Die besten und schlimmsten Beweise.</p></div>
    <label className="upload-fab"><Camera/>{busy?"Lädt …":"Foto hochladen"}<input type="file" accept="image/*" capture="environment" onChange={upload}/></label>
    <div className="photo-grid">{photos.map(p=><figure key={p.id}><img src={p.image_url} alt="Tourfoto" loading="lazy"/><figcaption>{p.profiles?.name} · {new Date(p.created_at).toLocaleString("de-DE")}</figcaption></figure>)}</div>
  </Shell></AuthGate>;
}
