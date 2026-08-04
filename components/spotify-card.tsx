import { ExternalLink, Music2 } from "lucide-react";

export function SpotifyCard({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a className="spotify-card" href={url} target="_blank" rel="noreferrer">
      <div className="spotify-logo"><Music2 /></div>
      <div><span className="eyebrow">UNSERE PLAYLIST</span><h3>Firestarter Soundtrack</h3><p>Song hinzufügen oder direkt loshören.</p></div>
      <ExternalLink />
    </a>
  );
}
