import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  let artwork = new URL("/brand/logo.jpeg", process.env.NEXT_PUBLIC_SITE_URL || "https://bachelortour-2026.vercel.app").toString();
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await supabase.from("event_settings").select("hero_image_url").eq("id", 1).maybeSingle();
    if (data?.hero_image_url) artwork = data.hero_image_url;
  } catch {}

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", position: "relative",
      backgroundColor: "#090909", overflow: "hidden"
    }}>
      <img src={artwork} alt="" width="512" height="512" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 42%" }}/>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 32, background: "linear-gradient(180deg, transparent 48%, rgba(0,0,0,.88))" }}>
        <div style={{ color: "#ff7a00", fontSize: 40, fontWeight: 900, letterSpacing: 2, textShadow: "0 4px 18px #000" }}>FIRESTARTER 2026</div>
      </div>
    </div>,
    { width: 512, height: 512, headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } }
  );
}
