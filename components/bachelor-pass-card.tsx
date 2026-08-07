"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CreditCard, FileImage, Maximize2, RefreshCw, ScanLine, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import "./bachelor-pass-card.css";

type ScanResult={file:File;preview:string;detected:boolean};

export function BachelorPassCard(){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const cameraRef=useRef<HTMLInputElement|null>(null);
  const uploadRef=useRef<HTMLInputElement|null>(null);
  const [imagePath,setImagePath]=useState<string|null>(null);
  const [imageUrl,setImageUrl]=useState("");
  const [scan,setScan]=useState<ScanResult|null>(null);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [viewerOpen,setViewerOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    if(!profile?.id)return;
    let active=true;
    (async()=>{
      const {data}=await supabase.from("bachelor_passes").select("image_path").eq("user_id",profile.id).maybeSingle();
      if(!active||!data?.image_path)return;
      setImagePath(data.image_path);
      const signed=await supabase.storage.from("bachelorpasses").createSignedUrl(data.image_path,60*60);
      if(active&&signed.data?.signedUrl)setImageUrl(signed.data.signedUrl);
    })();
    return()=>{active=false};
  },[profile?.id,supabase]);

  useEffect(()=>{
    if(!scannerOpen&&!viewerOpen)return;
    const old=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=old};
  },[scannerOpen,viewerOpen]);

  useEffect(()=>()=>{if(scan?.preview)URL.revokeObjectURL(scan.preview)},[scan?.preview]);

  async function chooseFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    if(!file.type.startsWith("image/")){setStatus("Bitte ein Bild auswählen.");return}
    if(file.size>20*1024*1024){setStatus("Das Bild ist zu groß. Maximal 20 MB.");return}
    setBusy(true);setStatus("Dokument wird erkannt …");
    try{
      const result=await autoScanDocument(file);
      setScan(result);
      setStatus(result.detected?"Bachelorpass automatisch erkannt und zugeschnitten.":"Dokumentkante nicht sicher erkannt – das Original wird als Fallback verwendet.");
      setScannerOpen(true);
    }catch(error){setStatus(error instanceof Error?error.message:"Bild konnte nicht verarbeitet werden.")}
    finally{setBusy(false)}
  }

  async function saveScan(){
    if(!profile?.id||!scan)return;
    setBusy(true);setStatus("Bachelorpass wird gespeichert …");
    const path=`${profile.id}/bachelorpass.jpg`;
    const upload=await supabase.storage.from("bachelorpasses").upload(path,scan.file,{upsert:true,contentType:"image/jpeg",cacheControl:"60"});
    if(upload.error){setStatus(upload.error.message);setBusy(false);return}
    const {error}=await supabase.from("bachelor_passes").upsert({user_id:profile.id,image_path:path,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error){setStatus(error.message);setBusy(false);return}
    const signed=await supabase.storage.from("bachelorpasses").createSignedUrl(path,60*60);
    setImagePath(path);setImageUrl(signed.data?.signedUrl?`${signed.data.signedUrl}&v=${Date.now()}`:scan.preview);
    setStatus("Bachelorpass gespeichert.");setBusy(false);setScannerOpen(false);setScan(null);
  }

  async function removePass(){
    if(!profile?.id||!imagePath||!confirm("Bachelorpass wirklich löschen?"))return;
    setBusy(true);
    const [{error:storageError},{error:dbError}]=await Promise.all([
      supabase.storage.from("bachelorpasses").remove([imagePath]),
      supabase.from("bachelor_passes").delete().eq("user_id",profile.id)
    ]);
    setBusy(false);
    const error=storageError||dbError;
    if(error){setStatus(error.message);return}
    setImagePath(null);setImageUrl("");setViewerOpen(false);setStatus("Bachelorpass gelöscht.");
  }

  if(!profile?.id)return null;

  const scanner=scannerOpen&&typeof document!=="undefined"?createPortal(
    <div className="bachelor-pass-overlay bachelor-pass-dark-overlay" role="dialog" aria-modal="true" aria-label="Bachelorpass scannen">
      <button className="bachelor-pass-backdrop" onClick={()=>!busy&&setScannerOpen(false)} aria-label="Schließen"/>
      <section className="bachelor-pass-scanner">
        <button className="bachelor-pass-close" onClick={()=>setScannerOpen(false)} disabled={busy} aria-label="Schließen"><X/></button>
        <div className="bachelor-pass-modal-head"><ScanLine/><div><span className="eyebrow">BACHELORPASS SCAN</span><h2>Scan prüfen</h2></div></div>
        {scan&&<div className="bachelor-pass-scan-preview"><img src={scan.preview} alt="Vorschau Bachelorpass"/><span className={scan.detected?"detected":"fallback"}>{scan.detected?"✓ Dokument erkannt":"Fallback: Originalbild"}</span></div>}
        <p>{status}</p>
        <div className="bachelor-pass-scanner-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={()=>cameraRef.current?.click()}><RefreshCw/>Neu scannen</button>
          <button type="button" className="primary-button" disabled={busy||!scan} onClick={saveScan}><Upload/>{busy?"Speichert …":"Scan speichern"}</button>
        </div>
      </section>
    </div>,document.body):null;

  const viewer=viewerOpen&&imageUrl&&typeof document!=="undefined"?createPortal(
    <div className="bachelor-pass-viewer" role="dialog" aria-modal="true" aria-label="Mein Bachelorpass">
      <button className="bachelor-pass-viewer-close" onClick={()=>setViewerOpen(false)} aria-label="Schließen"><X/></button>
      <div className="bachelor-pass-viewer-head"><span>BACHELORPASS</span><strong>{profile.name}</strong></div>
      <div className="bachelor-pass-display"><img src={imageUrl} alt="Bachelorpass"/></div>
      <div className="bachelor-pass-viewer-actions">
        <button onClick={()=>{setViewerOpen(false);cameraRef.current?.click()}}><Camera/>Neu scannen</button>
        <button onClick={removePass} disabled={busy}><Trash2/>Löschen</button>
      </div>
    </div>,document.body):null;

  return <>
    <section className="bachelor-pass-card">
      <div className="bachelor-pass-card-head"><CreditCard/><div><span className="eyebrow">DEIN BACHELORPASS</span><h2>Bachelorpass</h2></div></div>
      <p>{imageUrl?"Dein Bachelorpass ist gespeichert und jederzeit griffbereit.":"Scanne deinen Bachelorpass mit der Kamera oder lade ein vorhandenes Bild hoch."}</p>
      {imageUrl?<button className="bachelor-pass-open" onClick={()=>setViewerOpen(true)}><span className="bachelor-pass-thumb"><img src={imageUrl} alt=""/></span><span><strong>Pass anzeigen</strong><small>Öffnet extra hell auf weißem Hintergrund</small></span><Maximize2/></button>:<div className="bachelor-pass-add-actions"><button type="button" onClick={()=>cameraRef.current?.click()} disabled={busy}><Camera/><strong>Scannen</strong><small>Kamera öffnen & Dokument erkennen</small></button><button type="button" onClick={()=>uploadRef.current?.click()} disabled={busy}><FileImage/><strong>Bild wählen</strong><small>Fallback aus der Mediathek</small></button></div>}
      {status&&!scannerOpen&&<div className="bachelor-pass-inline-status">{status}</div>}
    </section>
    <input ref={cameraRef} className="bachelor-pass-hidden-input" type="file" accept="image/*" capture="environment" onChange={chooseFile}/>
    <input ref={uploadRef} className="bachelor-pass-hidden-input" type="file" accept="image/*" onChange={chooseFile}/>
    {scanner}{viewer}
  </>;
}

async function autoScanDocument(file:File):Promise<ScanResult>{
  const url=URL.createObjectURL(file);
  try{
    const image=await loadImage(url);
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const w=Math.max(1,Math.round(image.naturalWidth*scale));
    const h=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
    if(!ctx)throw new Error("Bildverarbeitung wird auf diesem Gerät nicht unterstützt.");
    ctx.drawImage(image,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h).data;
    const step=Math.max(2,Math.round(Math.max(w,h)/700));
    let borderLum=0,borderCount=0;
    for(let x=0;x<w;x+=step){for(const y of [0,Math.max(0,h-step)]){const i=(y*w+x)*4;borderLum+=lum(pixels[i],pixels[i+1],pixels[i+2]);borderCount++}}
    for(let y=0;y<h;y+=step){for(const x of [0,Math.max(0,w-step)]){const i=(y*w+x)*4;borderLum+=lum(pixels[i],pixels[i+1],pixels[i+2]);borderCount++}}
    const threshold=Math.max(135,(borderLum/Math.max(1,borderCount))+28);
    let minX=w,minY=h,maxX=0,maxY=0,count=0;
    for(let y=0;y<h;y+=step){for(let x=0;x<w;x+=step){const i=(y*w+x)*4;const r=pixels[i],g=pixels[i+1],b=pixels[i+2];const l=lum(r,g,b);const chroma=Math.max(r,g,b)-Math.min(r,g,b);if(l>threshold&&chroma<105){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++}}}
    const boxW=maxX-minX,boxH=maxY-minY;const boxArea=Math.max(0,boxW*boxH);const detected=count>80&&boxW>w*.35&&boxH>h*.3&&boxArea>w*h*.16&&boxArea<w*h*.97;
    let sx=0,sy=0,sw=w,sh=h;
    if(detected){const pad=Math.round(Math.min(w,h)*.015);sx=Math.max(0,minX-pad);sy=Math.max(0,minY-pad);sw=Math.min(w-sx,boxW+pad*2);sh=Math.min(h-sy,boxH+pad*2)}
    const out=document.createElement("canvas");const maxOut=1800;const outScale=Math.min(1,maxOut/Math.max(sw,sh));out.width=Math.max(1,Math.round(sw*outScale));out.height=Math.max(1,Math.round(sh*outScale));
    const outCtx=out.getContext("2d",{alpha:false});if(!outCtx)throw new Error("Scan konnte nicht erzeugt werden.");outCtx.imageSmoothingEnabled=true;outCtx.imageSmoothingQuality="high";outCtx.drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height);
    const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(v=>v?resolve(v):reject(new Error("Scan konnte nicht gespeichert werden.")),"image/jpeg",.9));
    return{file:new File([blob],"bachelorpass-scan.jpg",{type:"image/jpeg",lastModified:Date.now()}),preview:URL.createObjectURL(blob),detected};
  }finally{URL.revokeObjectURL(url)}
}

function lum(r:number,g:number,b:number){return .2126*r+.7152*g+.0722*b}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.decoding="async";img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Bild konnte nicht gelesen werden."));img.src=src})}
