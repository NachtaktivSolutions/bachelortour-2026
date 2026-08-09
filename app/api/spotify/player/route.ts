import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, spotifyFetch } from "@/lib/spotify-server";

function bearer(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

export async function GET(request: NextRequest) {
  try {
    const { sb } = await requireAdmin(bearer(request));
    const [devicesRes, currentRes, authResult] = await Promise.all([
      spotifyFetch(sb, "/me/player/devices"),
      spotifyFetch(sb, "/me/player/currently-playing"),
      sb.from("jukebox_spotify_auth").select("spotify_display_name,spotify_user_id,connected_at").eq("id", 1).maybeSingle(),
    ]);

    if (!devicesRes.ok) {
      return NextResponse.json({ connected: false, error: "Spotify nicht verbunden oder Zugriff abgelaufen." }, { status: 401 });
    }

    const devicesJson = await devicesRes.json() as any;
    let current = null;
    if (currentRes.status !== 204 && currentRes.ok) {
      const data = await currentRes.json() as any;
      current = data?.item ? {
        id: data.item.id,
        uri: data.item.uri,
        title: data.item.name,
        artist: (data.item.artists ?? []).map((a: any) => a.name).join(", "),
        image: data.item.album?.images?.[1]?.url ?? data.item.album?.images?.[0]?.url ?? null,
        progressMs: data.progress_ms ?? 0,
        durationMs: data.item.duration_ms ?? 0,
        isPlaying: Boolean(data.is_playing),
        device: data.device ? { id: data.device.id, name: data.device.name } : null,
      } : null;
    }

    return NextResponse.json({
      connected: true,
      account: authResult.data ?? null,
      devices: (devicesJson.devices ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        volume: d.volume_percent,
      })),
      current,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ connected: false, error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sb } = await requireAdmin(bearer(request));
    const body = await request.json() as { action: string; uri?: string; deviceId?: string };
    let res: Response;

    if (body.action === "play" && body.uri) {
      const qs = body.deviceId ? `?device_id=${encodeURIComponent(body.deviceId)}` : "";
      res = await spotifyFetch(sb, `/me/player/play${qs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [body.uri], position_ms: 0 }),
      });
    } else if (body.action === "resume") {
      const qs = body.deviceId ? `?device_id=${encodeURIComponent(body.deviceId)}` : "";
      res = await spotifyFetch(sb, `/me/player/play${qs}`, { method: "PUT" });
    } else if (body.action === "pause") {
      const qs = body.deviceId ? `?device_id=${encodeURIComponent(body.deviceId)}` : "";
      res = await spotifyFetch(sb, `/me/player/pause${qs}`, { method: "PUT" });
    } else if (body.action === "queue" && body.uri) {
      const qs = body.deviceId ? `&device_id=${encodeURIComponent(body.deviceId)}` : "";
      res = await spotifyFetch(sb, `/me/player/queue?uri=${encodeURIComponent(body.uri)}${qs}`, { method: "POST" });
    } else if (body.action === "skip") {
      const qs = body.deviceId ? `?device_id=${encodeURIComponent(body.deviceId)}` : "";
      res = await spotifyFetch(sb, `/me/player/next${qs}`, { method: "POST" });
    } else if (body.action === "transfer" && body.deviceId) {
      res = await spotifyFetch(sb, "/me/player", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_ids: [body.deviceId], play: false }),
      });
    } else {
      return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
    }

    if (!res.ok && res.status !== 204) {
      const text = await res.text();
      return NextResponse.json({ error: text || "Spotify-Aktion fehlgeschlagen." }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }
}
