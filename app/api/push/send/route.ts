import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Ungültige Sitzung." }, { status: 401 });

    const admin = createClient(url, service);
    const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: "Nur Admins dürfen Push senden." }, { status: 403 });

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://bachelortour-2026.vercel.app";
    if (!vapidPublic || !vapidPrivate) return NextResponse.json({ error: "Push ist noch nicht vollständig eingerichtet: VAPID-Schlüssel fehlen." }, { status: 500 });

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = await req.json();
    const { data: subscriptions } = await admin.from("push_subscriptions").select("*");
    let sent = 0;
    await Promise.all((subscriptions ?? []).map(async row => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || "/",
          tag: payload.tag || `firestarter-${Date.now()}`,
          timestamp: Date.now()
        }), { TTL: 86400, urgency: "high" });
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", row.id);
      }
    }));
    return NextResponse.json({ sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }, { status: 500 });
  }
}
