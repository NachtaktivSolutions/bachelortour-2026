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
type Point={x:number;y:number};

type LineFit={a:number;b:number};

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
      setStatus(result.detected?"Dokument automatisch erkannt, zugeschnitten und perspektivisch begradigt.":"Dokumentkante nicht sicher erkannt – das Original wird als Fallback verwendet.");
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
        {scan&&<div className="bachelor-pass-scan-preview"><img src={scan.preview} alt={`Vorschau ${activeSide==="front"?"Vorderseite":"Rückseite"}`}/><span className={scan.detected?"detected":"fallback"}>{scan.detected?"✓ Dokument erkannt & begradigt":"Fallback: Originalbild"}</span></div>}
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
    const image=await loadImage(url);
    const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight));
    const w=Math.max(1,Math.round(image.naturalWidth*scale));
    const h=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
    if(!ctx)throw new Error("Bildverarbeitung wird auf diesem Gerät nicht unterstützt.");
    ctx.drawImage(image,0,0,w,h);
    const imageData=ctx.getImageData(0,0,w,h);
    const pixels=imageData.data;
    const bg=estimateBackground(pixels,w,h);
    const borderDistances=sampleBorderDistances(pixels,w,h,bg);
    const threshold=Math.max(24,percentile(borderDistances,.88)+16);
    const step=Math.max(2,Math.round(Math.max(w,h)/700));

    const rowEdges:{y:number;left:number;right:number;count:number}[]=[];
    for(let y=step;y<h-step;y+=step){
      let left=w,right=-1,count=0;
      for(let x=step;x<w-step;x+=step){
        if(isDocumentPixel(pixels,w,x,y,bg,threshold)){left=Math.min(left,x);right=Math.max(right,x);count++}
      }
      if(count>=Math.max(8,Math.round((w/step)*.12)))rowEdges.push({y,left,right,count});
    }
    const colEdges:{x:number;top:number;bottom:number;count:number}[]=[];
    for(let x=step;x<w-step;x+=step){
      let top=h,bottom=-1,count=0;
      for(let y=step;y<h-step;y+=step){
        if(isDocumentPixel(pixels,w,x,y,bg,threshold)){top=Math.min(top,y);bottom=Math.max(bottom,y);count++}
      }
      if(count>=Math.max(8,Math.round((h/step)*.12)))colEdges.push({x,top,bottom,count});
    }

    let detected=false;
    let corners:Point[]=[];
    if(rowEdges.length>=12&&colEdges.length>=12){
      const yMin=percentile(rowEdges.map(v=>v.y),.04),yMax=percentile(rowEdges.map(v=>v.y),.96);
      const xMin=percentile(colEdges.map(v=>v.x),.04),xMax=percentile(colEdges.map(v=>v.x),.96);
      const rows=rowEdges.filter(v=>v.y>=yMin&&v.y<=yMax);
      const cols=colEdges.filter(v=>v.x>=xMin&&v.x<=xMax);
      const leftLine=fitXfromY(rows.map(v=>({x:v.left,y:v.y})));
      const rightLine=fitXfromY(rows.map(v=>({x:v.right,y:v.y})));
      const topLine=fitYfromX(cols.map(v=>({x:v.x,y:v.top})));
      const bottomLine=fitYfromX(cols.map(v=>({x:v.x,y:v.bottom})));
      const tl=intersect(leftLine,topLine);
      const tr=intersect(rightLine,topLine);
      const br=intersect(rightLine,bottomLine);
      const bl=intersect(leftLine,bottomLine);
      corners=[tl,tr,br,bl];
      const area=polygonArea(corners);
      const minEdge=Math.min(distance(tl,tr),distance(tr,br),distance(br,bl),distance(bl,tl));
      detected=corners.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>-w*.08&&p.x<w*1.08&&p.y>-h*.08&&p.y<h*1.08)&&area>w*h*.14&&area<w*h*.96&&minEdge>Math.min(w,h)*.2;
    }

    let out:HTMLCanvasElement;
    if(detected){
      const padded=expandQuad(corners,w,h,.008);
      out=warpQuadrilateral(imageData,padded);
    }else{
      out=document.createElement("canvas");
      const maxOut=1800,outScale=Math.min(1,maxOut/Math.max(w,h));
      out.width=Math.max(1,Math.round(w*outScale));out.height=Math.max(1,Math.round(h*outScale));
      const outCtx=out.getContext("2d",{alpha:false});if(!outCtx)throw new Error("Scan konnte nicht erzeugt werden.");
      outCtx.imageSmoothingEnabled=true;outCtx.imageSmoothingQuality="high";outCtx.drawImage(canvas,0,0,out.width,out.height);
    }

    const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(v=>v?resolve(v):reject(new Error("Scan konnte nicht gespeichert werden.")),"image/jpeg",.92));
    return{file:new File([blob],"bachelorpass-scan.jpg",{type:"image/jpeg",lastModified:Date.now()}),preview:URL.createObjectURL(blob),detected};
  }finally{URL.revokeObjectURL(url)}
}

function estimateBackground(pixels:Uint8ClampedArray,w:number,h:number){
  const samples:{r:number;g:number;b:number}[]=[];
  const stride=Math.max(4,Math.round(Math.max(w,h)/180));
  const band=Math.max(stride,Math.round(Math.min(w,h)*.035));
  for(let x=0;x<w;x+=stride){for(const y of [band,Math.max(0,h-band-1)])pushColor(samples,pixels,w,x,y)}
  for(let y=0;y<h;y+=stride){for(const x of [band,Math.max(0,w-band-1)])pushColor(samples,pixels,w,x,y)}
  return{r:median(samples.map(s=>s.r)),g:median(samples.map(s=>s.g)),b:median(samples.map(s=>s.b))};
}

function pushColor(target:{r:number;g:number;b:number}[],pixels:Uint8ClampedArray,w:number,x:number,y:number){const i=(Math.round(y)*w+Math.round(x))*4;target.push({r:pixels[i],g:pixels[i+1],b:pixels[i+2]})}
function sampleBorderDistances(pixels:Uint8ClampedArray,w:number,h:number,bg:{r:number;g:number;b:number}){const values:number[]=[];const stride=Math.max(4,Math.round(Math.max(w,h)/180));const band=Math.max(stride,Math.round(Math.min(w,h)*.035));for(let x=0;x<w;x+=stride){for(const y of [band,Math.max(0,h-band-1)])values.push(colorDistanceAt(pixels,w,x,y,bg))}for(let y=0;y<h;y+=stride){for(const x of [band,Math.max(0,w-band-1)])values.push(colorDistanceAt(pixels,w,x,y,bg))}return values}
function colorDistanceAt(pixels:Uint8ClampedArray,w:number,x:number,y:number,bg:{r:number;g:number;b:number}){const i=(y*w+x)*4;const dr=pixels[i]-bg.r,dg=pixels[i+1]-bg.g,db=pixels[i+2]-bg.b;return Math.sqrt(dr*dr*.8+dg*dg+db*db*.8)}
function isDocumentPixel(pixels:Uint8ClampedArray,w:number,x:number,y:number,bg:{r:number;g:number;b:number},threshold:number){const i=(y*w+x)*4;const r=pixels[i],g=pixels[i+1],b=pixels[i+2];const dist=colorDistanceAt(pixels,w,x,y,bg);const pinkBias=r-(g+b)/2;const bgPink=bg.r-(bg.g+bg.b)/2;return dist>threshold||(pinkBias-bgPink>14&&r>80)}
function median(values:number[]){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function percentile(values:number[],p:number){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const i=Math.max(0,Math.min(a.length-1,Math.round((a.length-1)*p)));return a[i]}
function fitXfromY(points:Point[]):LineFit{let sy=0,sx=0,syy=0,syx=0;const n=Math.max(1,points.length);for(const p of points){sy+=p.y;sx+=p.x;syy+=p.y*p.y;syx+=p.y*p.x}const d=n*syy-sy*sy;if(Math.abs(d)<1e-6)return{a:0,b:sx/n};const a=(n*syx-sy*sx)/d;return{a,b:(sx-a*sy)/n}}
function fitYfromX(points:Point[]):LineFit{let sx=0,sy=0,sxx=0,sxy=0;const n=Math.max(1,points.length);for(const p of points){sx+=p.x;sy+=p.y;sxx+=p.x*p.x;sxy+=p.x*p.y}const d=n*sxx-sx*sx;if(Math.abs(d)<1e-6)return{a:0,b:sy/n};const a=(n*sxy-sx*sy)/d;return{a,b:(sy-a*sx)/n}}
function intersect(xFromY:LineFit,yFromX:LineFit):Point{const denom=1-xFromY.a*yFromX.a;if(Math.abs(denom)<1e-6)return{x:xFromY.b,y:yFromX.b};const x=(xFromY.a*yFromX.b+xFromY.b)/denom;return{x,y:yFromX.a*x+yFromX.b}}
function distance(a:Point,b:Point){return Math.hypot(a.x-b.x,a.y-b.y)}
function polygonArea(p:Point[]){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y}return Math.abs(s)/2}
function expandQuad(points:Point[],w:number,h:number,amount:number){const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;return points.map(p=>({x:clamp(p.x+(p.x-cx)*amount,0,w-1),y:clamp(p.y+(p.y-cy)*amount,0,h-1)}))}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

function warpQuadrilateral(src:ImageData,quad:Point[]){
  const [tl,tr,br,bl]=quad;
  const width=Math.max(distance(tl,tr),distance(bl,br));
  const height=Math.max(distance(tl,bl),distance(tr,br));
  const maxOut=1800,scale=Math.min(1,maxOut/Math.max(width,height));
  const outW=Math.max(320,Math.round(width*scale)),outH=Math.max(220,Math.round(height*scale));
  const dst=[{x:0,y:0},{x:outW-1,y:0},{x:outW-1,y:outH-1},{x:0,y:outH-1}];
  const h=solveHomography(dst,quad);
  const canvas=document.createElement("canvas");canvas.width=outW;canvas.height=outH;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw new Error("Perspektivkorrektur wird auf diesem Gerät nicht unterstützt.");
  const out=ctx.createImageData(outW,outH),s=src.data,d=out.data,sw=src.width,sh=src.height;
  for(let y=0;y<outH;y++){
    for(let x=0;x<outW;x++){
      const den=h[6]*x+h[7]*y+1;
      const sx=(h[0]*x+h[1]*y+h[2])/den,sy=(h[3]*x+h[4]*y+h[5])/den;
      const x0=clamp(Math.floor(sx),0,sw-1),y0=clamp(Math.floor(sy),0,sh-1),x1=clamp(x0+1,0,sw-1),y1=clamp(y0+1,0,sh-1);
      const fx=clamp(sx-x0,0,1),fy=clamp(sy-y0,0,1);const i00=(y0*sw+x0)*4,i10=(y0*sw+x1)*4,i01=(y1*sw+x0)*4,i11=(y1*sw+x1)*4,di=(y*outW+x)*4;
      for(let c=0;c<3;c++){const top=s[i00+c]*(1-fx)+s[i10+c]*fx,bottom=s[i01+c]*(1-fx)+s[i11+c]*fx;d[di+c]=top*(1-fy)+bottom*fy}d[di+3]=255;
    }
  }
  ctx.putImageData(out,0,0);return canvas;
}

function solveHomography(from:Point[],to:Point[]){
  const a:number[][]=[];
  for(let i=0;i<4;i++){
    const u=from[i].x,v=from[i].y,x=to[i].x,y=to[i].y;
    a.push([u,v,1,0,0,0,-x*u,-x*v,x]);
    a.push([0,0,0,u,v,1,-y*u,-y*v,y]);
  }
  for(let col=0;col<8;col++){
    let pivot=col;for(let r=col+1;r<8;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const div=a[col][col]||1e-9;for(let c=col;c<9;c++)a[col][c]/=div;
    for(let r=0;r<8;r++){if(r===col)continue;const f=a[r][col];for(let c=col;c<9;c++)a[r][c]-=f*a[col][c]}
  }
  return a.map(row=>row[8]);
}

function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.decoding="async";img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Bild konnte nicht gelesen werden."));img.src=src})}
