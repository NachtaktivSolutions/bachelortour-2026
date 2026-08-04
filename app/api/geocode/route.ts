import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) return NextResponse.json({ error: "Adresse fehlt." }, { status: 400 });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Firestarter-2026-PWA/1.0 (dennis.haag@hotmail.de)",
      "Accept-Language": "de"
    },
    next: { revalidate: 86400 }
  });

  if (!response.ok) return NextResponse.json({ error: "Adresse konnte nicht gesucht werden." }, { status: 502 });
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  if (!results.length) return NextResponse.json({ error: "Keine Koordinaten für diese Adresse gefunden." }, { status: 404 });

  return NextResponse.json({
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
    display_name: results[0].display_name
  });
}
