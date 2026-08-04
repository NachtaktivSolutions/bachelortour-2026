"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Music2 } from "lucide-react";

type SpotifyMeta = { title: string; image: string | null; provider: string };

export function SpotifyCard({ url }: { url?: string | null }) {
  const [meta, setMeta] = useState<SpotifyMeta | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    fetch(`/api/spotify?url=${encodeURIComponent(url)}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data) setMeta(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [url]);

  if (!url) return null;
  return (
    <a className="spotify-card spotify-card-v16" href={url} target="_blank" rel="noreferrer">
      <div className="spotify-logo spotify-cover">
        {meta?.image ? <img src={meta.image} alt="Spotify Playlist Cover" /> : <Music2 />}
      </div>
      <div className="spotify-copy">
        <span className="eyebrow">UNSERE PLAYLIST</span>
        <h3>{meta?.title || "Firestarter Soundtrack"}</h3>
        <p>{meta ? `${meta.provider} · Antippen zum Öffnen` : "Song hinzufügen oder direkt loshören."}</p>
      </div>
      <ExternalLink />
    </a>
  );
}
