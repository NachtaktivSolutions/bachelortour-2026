import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getContext(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Nicht angemeldet.", status: 401 } as const;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return { error: "Ungültige Sitzung.", status: 401 } as const;
  const admin = createClient(url, service);
  const { data: profile } = await admin.from("profiles").select("id,name,is_admin").eq("id", user.id).single();
  if (!profile) return { error: "Profil nicht gefunden.", status: 404 } as const;
  return { admin, user, profile } as const;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "toggle") {
      if (!ctx.profile.is_admin) return NextResponse.json({ error: "Nur Admins dürfen die Tour-Verbrennung freischalten." }, { status: 403 });
      const enabled = Boolean(body.enabled);
      const { error } = await ctx.admin.from("app_settings").update({ tour_burn_enabled: enabled, updated_at: new Date().toISOString(), updated_by: ctx.user.id }).eq("id", 1);
      if (error) throw error;
      return NextResponse.json({ ok: true, enabled });
    }

    if (action === "burn") {
      const now = new Date().toISOString();
      const { data, error } = await ctx.admin.from("app_settings")
        .update({ tour_burned: true, tour_burned_at: now, tour_burned_by: ctx.user.id, updated_at: now, updated_by: ctx.user.id })
        .eq("id", 1).eq("tour_burn_enabled", true).eq("tour_burned", false)
        .select("tour_burned").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Die Tour kann aktuell nicht verbrannt werden oder wurde bereits verbrannt." }, { status: 409 });
      return NextResponse.json({ ok: true, burned: true });
    }

    if (action === "reset") {
      if (!ctx.profile.is_admin) return NextResponse.json({ error: "Nur Admins dürfen die Tour wiederherstellen." }, { status: 403 });
      const { error } = await ctx.admin.from("app_settings").update({ tour_burned: false, tour_burned_at: null, tour_burned_by: null, updated_at: new Date().toISOString(), updated_by: ctx.user.id }).eq("id", 1);
      if (error) throw error;
      return NextResponse.json({ ok: true, burned: false });
    }

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tour-Verbrennung fehlgeschlagen." }, { status: 500 });
  }
}
