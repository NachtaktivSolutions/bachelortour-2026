import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url || !/^https:\/\/(open\.)?spotify\.com\//i.test(url)) {
    return NextResponse.json({ error: "Ungültige Spotify-Adresse." }, { status: 400 });
  }

  const endpoint = new URL("https://open.spotify.com/oembed");
  endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
  if (!response.ok) return NextResponse.json({ error: "Spotify-Daten konnten nicht geladen werden." }, { status: 502 });

  const data = await response.json() as { title?: string; thumbnail_url?: string; provider_name?: string };
  return NextResponse.json({
    title: data.title || "Spotify Playlist",
    image: data.thumbnail_url || null,
    provider: data.provider_name || "Spotify"
  });
}
