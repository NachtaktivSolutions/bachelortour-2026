"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Crop, X } from "lucide-react";

type Props = {
  file: File;
  aspect?: number;
  round?: boolean;
  title?: string;
  onCancel: () => void;
  onComplete: (file: File, previewUrl: string) => void;
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function ImageCropper({ file, aspect = 1, round = false, title = "Bild zuschneiden", onCancel, onComplete }: Props) {
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error,setError]=useState("");

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  async function finish() {
    if(busy)return;
    setError("");
    if(!file.type.startsWith("image/")){
      setError("Diese Datei ist kein unterstütztes Bild.");
      return;
    }
    if(file.size>MAX_IMAGE_BYTES){
      setError("Das Bild ist zu groß. Bitte ein Bild unter 25 MB auswählen.");
      return;
    }

    setBusy(true);
    try {
      const image = await loadImage(sourceUrl);
      const sourceWidth=image.naturalWidth;
      const sourceHeight=image.naturalHeight;
      if(!sourceWidth||!sourceHeight)throw new Error("Das Bild enthält keine lesbaren Bilddaten.");

      const outWidth = aspect >= 1 ? 1200 : Math.round(1200 * aspect);
      const outHeight = Math.round(outWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d",{alpha:false});
      if (!ctx) throw new Error("Der Bildeditor wird von diesem Browser nicht unterstützt.");

      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.fillStyle="#111";
      ctx.fillRect(0,0,outWidth,outHeight);

      const baseScale = Math.max(outWidth / sourceWidth, outHeight / sourceHeight);
      const scale = baseScale * zoom;
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const overflowX = Math.max(0, drawWidth - outWidth);
      const overflowY = Math.max(0, drawHeight - outHeight);
      const drawX = -(overflowX * x / 100);
      const drawY = -(overflowY * y / 100);
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Das zugeschnittene Bild konnte nicht erzeugt werden.")), "image/jpeg", .88));
      const baseName=(file.name||"profilbild").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g,"-")||"profilbild";
      const cropped = new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg",lastModified:Date.now() });
      onComplete(cropped, URL.createObjectURL(blob));
    } catch(reason) {
      setError(reason instanceof Error?reason.message:"Das Bild konnte auf diesem Gerät nicht verarbeitet werden.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="cropper-backdrop" onClick={busy?undefined:onCancel}>
    <section className="cropper-card" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Bildeditor schließen"><X /></button>
      <div className="cropper-title"><Crop /><div><span className="eyebrow">BILDAUSSCHNITT</span><h2>{title}</h2></div></div>
      <div className={`cropper-stage ${round ? "round" : ""}`} style={{ aspectRatio: String(aspect) }}>
        <img
          src={sourceUrl}
          alt="Vorschau"
          draggable={false}
          onError={()=>setError("Dieses Bildformat kann auf diesem Gerät nicht geöffnet werden.")}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            inset: 0,
            objectFit: "cover",
            objectPosition: `${x}% ${y}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${x}% ${y}%`,
            transition: "transform 80ms linear, object-position 80ms linear",
            touchAction:"none"
          }}
        />
      </div>
      <label>Zoom <strong>{Math.round(zoom * 100)} %</strong><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} disabled={busy}/></label>
      <label>Horizontal positionieren<input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))} disabled={busy}/></label>
      <label>Vertikal positionieren<input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))} disabled={busy}/></label>
      {error&&<div className="status error" role="alert"><AlertTriangle/>{error}</div>}
      <div className="cropper-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Abbrechen</button><button type="button" className="primary-button" onClick={finish} disabled={busy||Boolean(error)}>{busy ? "Wird zugeschnitten …" : "Ausschnitt übernehmen"}</button></div>
    </section>
  </div>;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding="async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Dieses Bildformat konnte nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden."));
    image.src = src;
  });
}
