import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("event_settings")
      .select("hero_image_url")
      .eq("id", 1)
      .maybeSingle();

    if (data?.hero_image_url) {
      return NextResponse.redirect(data.hero_image_url, 307);
    }
  } catch {}

  return NextResponse.redirect(new URL("/icons/icon-192.png", process.env.NEXT_PUBLIC_SITE_URL || "https://bachelortour-2026.vercel.app"), 307);
}
