"use client";

import { useEffect, useMemo, useState } from "react";
import { Crop, X } from "lucide-react";

type Props = {
  file: File;
  aspect?: number;
  round?: boolean;
  title?: string;
  onCancel: () => void;
  onComplete: (file: File, previewUrl: string) => void;
};

export function ImageCropper({ file, aspect = 1, round = false, title = "Bild zuschneiden", onCancel, onComplete }: Props) {
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  async function finish() {
    setBusy(true);
    try {
      const image = await loadImage(sourceUrl);
      const outWidth = aspect >= 1 ? 1400 : Math.round(1400 * aspect);
      const outHeight = Math.round(outWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Bildeditor konnte nicht gestartet werden.");

      const baseScale = Math.max(outWidth / image.naturalWidth, outHeight / image.naturalHeight);
      const scale = baseScale * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const maxX = Math.max(0, drawWidth - outWidth);
      const maxY = Math.max(0, drawHeight - outHeight);
      const drawX = -(maxX * x / 100);
      const drawY = -(maxY * y / 100);
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Bild konnte nicht erzeugt werden.")), "image/jpeg", .9));
      const cropped = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.jpg`, { type: "image/jpeg" });
      onComplete(cropped, URL.createObjectURL(blob));
    } finally {
      setBusy(false);
    }
  }

  return <div className="cropper-backdrop" onClick={onCancel}>
    <section className="cropper-card" onClick={event => event.stopPropagation()}>
      <button className="modal-close" onClick={onCancel}><X /></button>
      <div className="cropper-title"><Crop /><div><span className="eyebrow">BILDAUSSCHNITT</span><h2>{title}</h2></div></div>
      <div className={`cropper-stage ${round ? "round" : ""}`} style={{ aspectRatio: String(aspect) }}>
        <img src={sourceUrl} alt="Vorschau" style={{ transform: `scale(${zoom})`, objectPosition: `${x}% ${y}%` }} />
      </div>
      <label>Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <label>Horizontal positionieren<input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))} /></label>
      <label>Vertikal positionieren<input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))} /></label>
      <div className="cropper-actions"><button className="secondary-button" onClick={onCancel}>Abbrechen</button><button className="primary-button" onClick={finish} disabled={busy}>{busy ? "Wird zugeschnitten …" : "Ausschnitt übernehmen"}</button></div>
    </section>
  </div>;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = src;
  });
}
