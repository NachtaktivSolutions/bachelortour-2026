"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CreditCard, FileImage, Maximize2, RefreshCw, ScanLine, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import "./bachelor-pass-card.css";

type Side="front"|"back";
type ScanResult={file:File;preview:string;detected:boolean};
type PassData={front_image_path:string|null;back_image_path:string|null;image_path:string|null};

export function BachelorPassCard(){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const cameraRef=useRef<HTMLInputElement|null>(null);
  const uploadRef=useRef<HTMLInputElement|null>(null);
  const [activeSide,setActiveSide]=useState<Side>("front");
  const [frontPath,setFrontPath]=useState<string|null>(null);
  const [backPath,setBackPath]=useState<string|null>(null);
  const [frontUrl,setFrontUrl]=useState("");
  const [backUrl,setBackUrl]=useState("");
  const [scan,setScan]=useState<ScanResult|null>(null);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [viewerOpen,setViewerOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    if(!profile?.id)return;
    let active=true;
    (async()=>{
      const {data}=await supabase.from("bachelor_passes").select("front_image_path,back_image_path,image_path").eq("user_id",profile.id).maybeSingle();
      if(!active||!data)return;
      const pass=data as PassData;
      const front=pass.front_image_path||pass.image_path||null;
      const back=pass.back_image_path||null;
      setFrontPath(front);setBackPath(back);
      const [frontSigned,backSigned]=await Promise.all([
        front?supabase.storage.from("bachelorpasses").createSignedUrl(front,60*60):Promise.resolve({data:null}),
        back?supabase.storage.from("bachelorpasses").createSignedUrl(back,60*60):Promise.resolve({data:null})
      ]);
      if(!active)return;
      if(frontSigned.data?.signedUrl)setFrontUrl(frontSigned.data.signedUrl);
      if(backSigned.data?.signedUrl)setBackUrl(backSigned.data.signedUrl);
    })();
    return()=>{active=false};
  },[profile?.id,supabase]);

  useEffect(()=>{
    if(!scannerOpen&&!viewerOpen)return;
    const old=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=old};
  },[scannerOpen,viewerOpen]);
  useEffect(()=>()=>{if(scan?.preview)URL.revokeObjectURL(scan.preview)},[scan?.preview]);

  function openPicker(side:Side,source:"camera"|"upload"){
    setActiveSide(side);setStatus("");
    window.setTimeout(()=>source==="camera"?cameraRef.current?.click():uploadRef.current?.click(),0);
  }

  async function chooseFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    if(!file.type.startsWith("image/")){setStatus("Bitte ein Bild auswählen.");return}
    if(file.size>20*1024*1024){setStatus("Das Bild ist zu groß. Maximal 20 MB.");return}
    setBusy(true);setStatus(`${activeSide==="front"?"Vorderseite":"Rückseite"} wird erkannt …`);
    try{
      const result=await autoScanDocument(file);
      setScan(result);setScannerOpen(true);
      setStatus(result.detected?"Dokument automatisch erkannt und zugeschnitten.":"Dokumentkante nicht sicher erkannt – das Original wird als Fallback verwendet.");
    }catch(error){setStatus(error instanceof Error?error.message:"Bild konnte nicht verarbeitet werden.")}
    finally{setBusy(false)}
  }

  async function saveScan(){
    if(!profile?.id||!scan)return;
    const sideLabel=activeSide==="front"?"Vorderseite":"Rückseite";
    setBusy(true);setStatus(`${sideLabel} wird gespeichert …`);
    const path=`${profile.id}/bachelorpass-${activeSide}.jpg`;
    const upload=await supabase.storage.from("bachelorpasses").upload(path,scan.file,{upsert:true,contentType:"image/jpeg",cacheControl:"60"});
    if(upload.error){setStatus(upload.error.message);setBusy(false);return}

    let dbError:null|{message:string}=null;
    if(activeSide==="front"){
      const {error}=await supabase.from("bachelor_passes").upsert({user_id:profile.id,front_image_path:path,image_path:path,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      dbError=error;
    }else{
      const {error}=await supabase.from("bachelor_passes").upsert({user_id:profile.id,back_image_path:path,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      dbError=error;
    }
    if(dbError){setStatus(dbError.message);setBusy(false);return}

    const signed=await supabase.storage.from("bachelorpasses").createSignedUrl(path,60*60);
    const url=signed.data?.signedUrl?`${signed.data.signedUrl}&v=${Date.now()}`:scan.preview;
    if(activeSide==="front"){setFrontPath(path);setFrontUrl(url)}else{setBackPath(path);setBackUrl(url)}
    setStatus(`${sideLabel} gespeichert.`);setBusy(false);setScannerOpen(false);setScan(null);
  }

  async function removePass(){
    if(!profile?.id||(!frontPath&&!backPath)||!confirm("Bachelorpass mit Vorder- und Rückseite wirklich löschen?"))return;
    setBusy(true);
    const paths=Array.from(new Set([frontPath,backPath].filter(Boolean) as string[]));
    const storageResult=paths.length?await supabase.storage.from("bachelorpasses").remove(paths):{error:null};
    const {error:dbError}=await supabase.from("bachelor_passes").delete().eq("user_id",profile.id);
    setBusy(false);const error=storageResult.error||dbError;
    if(error){setStatus(error.message);return}
    setFrontPath(null);setBackPath(null);setFrontUrl("");setBackUrl("");setViewerOpen(false);setStatus("Bachelorpass gelöscht.");
  }

  if(!profile?.id)return null;
  const hasAny=Boolean(frontUrl||backUrl);const complete=Boolean(frontUrl&&backUrl);
  const scanner=scannerOpen&&typeof document!=="undefined"?createPortal(
    <div className="bachelor-pass-overlay bachelor-pass-dark-overlay" role="dialog" aria-modal="true" aria-label="Bachelorpass scannen">
      <button className="bachelor-pass-backdrop" onClick={()=>!busy&&setScannerOpen(false)} aria-label="Schließen"/>
      <section className="bachelor-pass-scanner">
        <button className="bachelor-pass-close" onClick={()=>setScannerOpen(false)} disabled={busy} aria-label="Schließen"><X/></button>
        <div className="bachelor-pass-modal-head"><ScanLine/><div><span className="eyebrow">BACHELORPASS SCAN</span><h2>{activeSide==="front"?"Vorderseite":"Rückseite"} prüfen</h2></div></div>
        {scan&&<div className="bachelor-pass-scan-preview"><img src={scan.preview} alt={`Vorschau ${activeSide==="front"?"Vorderseite":"Rückseite"}`}/><span className={scan.detected?"detected":"fallback"}>{scan.detected?"✓ Dokument erkannt":"Fallback: Originalbild"}</span></div>}
        <p>{status}</p>
        <div className="bachelor-pass-scanner-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>openPicker(activeSide,"camera")}><RefreshCw/>Neu scannen</button><button type="button" className="primary-button" disabled={busy||!scan} onClick={saveScan}><Upload/>{busy?"Speichert …":`${activeSide==="front"?"Vorderseite":"Rückseite"} speichern`}</button></div>
      </section>
    </div>,document.body):null;

  const viewer=viewerOpen&&hasAny&&typeof document!=="undefined"?createPortal(
    <div className="bachelor-pass-viewer" role="dialog" aria-modal="true" aria-label="Mein Bachelorpass">
      <button className="bachelor-pass-viewer-close" onClick={()=>setViewerOpen(false)} aria-label="Schließen"><X/></button>
      <div className="bachelor-pass-viewer-head"><span>BACHELORPASS</span><strong>{profile.name}</strong><small>Vorder- und Rückseite</small></div>
      <div className="bachelor-pass-dual-display">
        <div className="bachelor-pass-side"><b>Vorderseite</b>{frontUrl?<img src={frontUrl} alt="Bachelorpass Vorderseite"/>:<button onClick={()=>{setViewerOpen(false);openPicker("front","camera")}}>Vorderseite scannen</button>}</div>
        <div className="bachelor-pass-side"><b>Rückseite</b>{backUrl?<img src={backUrl} alt="Bachelorpass Rückseite"/>:<button onClick={()=>{setViewerOpen(false);openPicker("back","camera")}}>Rückseite scannen</button>}</div>
      </div>
      <div className="bachelor-pass-viewer-actions"><button onClick={()=>{setViewerOpen(false);openPicker("front","camera")}}><Camera/>Vorderseite neu</button><button onClick={()=>{setViewerOpen(false);openPicker("back","camera")}}><Camera/>Rückseite neu</button><button onClick={removePass} disabled={busy}><Trash2/>Löschen</button></div>
    </div>,document.body):null;

  return <>
    <section className="bachelor-pass-card">
      <div className="bachelor-pass-card-head"><CreditCard/><div><span className="eyebrow">DEIN BACHELORPASS</span><h2>Bachelorpass</h2></div></div>
      <p>{complete?"Vorder- und Rückseite sind gespeichert und jederzeit griffbereit.":hasAny?"Eine Seite ist schon gespeichert. Ergänze jetzt noch die fehlende Seite.":"Scanne Vorder- und Rückseite mit der Kamera oder wähle vorhandene Fotos aus."}</p>
      {hasAny&&<button className="bachelor-pass-open" onClick={()=>setViewerOpen(true)}><span className="bachelor-pass-thumb bachelor-pass-double-thumb">{frontUrl&&<img src={frontUrl} alt=""/>}{backUrl&&<img src={backUrl} alt=""/>}</span><span><strong>Pass anzeigen</strong><small>{complete?"Beide Seiten gleichzeitig · extra helle Ansicht":"Gespeicherte Seite anzeigen"}</small></span><Maximize2/></button>}
      <div className="bachelor-pass-side-actions">
        <div className={frontUrl?"is-complete":""}><strong>Vorderseite {frontUrl?"✓":""}</strong><span><button type="button" onClick={()=>openPicker("front","camera")} disabled={busy}><Camera/>Scannen</button><button type="button" onClick={()=>openPicker("front","upload")} disabled={busy}><FileImage/>Foto</button></span></div>
        <div className={backUrl?"is-complete":""}><strong>Rückseite {backUrl?"✓":""}</strong><span><button type="button" onClick={()=>openPicker("back","camera")} disabled={busy}><Camera/>Scannen</button><button type="button" onClick={()=>openPicker("back","upload")} disabled={busy}><FileImage/>Foto</button></span></div>
      </div>
      {status&&!scannerOpen&&<div className="bachelor-pass-inline-status">{status}</div>}
    </section>
    <input ref={cameraRef} className="bachelor-pass-hidden-input" type="file" accept="image/*" capture="environment" onChange={chooseFile}/><input ref={uploadRef} className="bachelor-pass-hidden-input" type="file" accept="image/*" onChange={chooseFile}/>
    {scanner}{viewer}
  </>;
}

async function autoScanDocument(file:File):Promise<ScanResult>{
  const url=URL.createObjectURL(file);
  try{
    const image=await loadImage(url);const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const w=Math.max(1,Math.round(image.naturalWidth*scale));const h=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});if(!ctx)throw new Error("Bildverarbeitung wird auf diesem Gerät nicht unterstützt.");ctx.drawImage(image,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h).data;const step=Math.max(2,Math.round(Math.max(w,h)/700));let borderLum=0,borderCount=0;
    for(let x=0;x<w;x+=step){for(const y of [0,Math.max(0,h-step)]){const i=(y*w+x)*4;borderLum+=lum(pixels[i],pixels[i+1],pixels[i+2]);borderCount++}}for(let y=0;y<h;y+=step){for(const x of [0,Math.max(0,w-step)]){const i=(y*w+x)*4;borderLum+=lum(pixels[i],pixels[i+1],pixels[i+2]);borderCount++}}
    const threshold=Math.max(135,(borderLum/Math.max(1,borderCount))+28);let minX=w,minY=h,maxX=0,maxY=0,count=0;
    for(let y=0;y<h;y+=step){for(let x=0;x<w;x+=step){const i=(y*w+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],l=lum(r,g,b),chroma=Math.max(r,g,b)-Math.min(r,g,b);if(l>threshold&&chroma<105){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++}}}
    const boxW=maxX-minX,boxH=maxY-minY,boxArea=Math.max(0,boxW*boxH);const detected=count>80&&boxW>w*.35&&boxH>h*.3&&boxArea>w*h*.16&&boxArea<w*h*.97;let sx=0,sy=0,sw=w,sh=h;
    if(detected){const pad=Math.round(Math.min(w,h)*.015);sx=Math.max(0,minX-pad);sy=Math.max(0,minY-pad);sw=Math.min(w-sx,boxW+pad*2);sh=Math.min(h-sy,boxH+pad*2)}
    const out=document.createElement("canvas"),maxOut=1800,outScale=Math.min(1,maxOut/Math.max(sw,sh));out.width=Math.max(1,Math.round(sw*outScale));out.height=Math.max(1,Math.round(sh*outScale));const outCtx=out.getContext("2d",{alpha:false});if(!outCtx)throw new Error("Scan konnte nicht erzeugt werden.");outCtx.imageSmoothingEnabled=true;outCtx.imageSmoothingQuality="high";outCtx.drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height);
    const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(v=>v?resolve(v):reject(new Error("Scan konnte nicht gespeichert werden.")),"image/jpeg",.9));return{file:new File([blob],"bachelorpass-scan.jpg",{type:"image/jpeg",lastModified:Date.now()}),preview:URL.createObjectURL(blob),detected};
  }finally{URL.revokeObjectURL(url)}
}
function lum(r:number,g:number,b:number){return .2126*r+.7152*g+.0722*b}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.decoding="async";img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Bild konnte nicht gelesen werden."));img.src=src})}
