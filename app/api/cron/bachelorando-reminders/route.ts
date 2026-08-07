import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, service);

    const supplied = req.headers.get("x-scheduler-token");
    const { data: config } = await admin.from("scheduler_config").select("token").eq("id", 1).single();
    if (!supplied || !config?.token || supplied !== config.token) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    const { data: orders, error: orderError } = await admin
      .from("bachelorando_orders")
      .select("id,item,quantity,seat,status,requester:profiles!bachelorando_orders_requester_id_fkey(name)")
      .in("status", ["open", "claimed"])
      .order("created_at", { ascending: true });

    if (orderError) throw orderError;
    if (!orders?.length) return NextResponse.json({ sent: 0, activeOrders: 0 });

    const { data: stamps, error: stampError } = await admin
      .from("member_stamps")
      .select("user_id")
      .ilike("label", "%Neu-Bachelor%");
    if (stampError) throw stampError;

    const userIds = [...new Set((stamps ?? []).map((row: any) => String(row.user_id)).filter(Boolean))];
    if (!userIds.length) return NextResponse.json({ sent: 0, activeOrders: orders.length, recipients: 0 });

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://bachelortour-2026.vercel.app";
    if (!vapidPublic || !vapidPrivate) throw new Error("VAPID-Schlüssel fehlen.");
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,subscription")
      .in("user_id", userIds);
    if (subscriptionError) throw subscriptionError;

    const first: any = orders[0];
    const firstName = first?.requester?.name || "Ein Bachelor";
    const body = orders.length === 1
      ? `${firstName} wartet noch auf ${first.quantity}× ${first.item} · ${first.seat}.`
      : `${orders.length} Bachelorando-Bestellungen warten noch auf euch.`;

    let sent = 0;
    await Promise.all((subscriptions ?? []).map(async (row: any) => {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title: "🍺 Bachelorando-Erinnerung",
            body,
            url: "/bachelorando",
            tag: "bachelorando-reminder",
            timestamp: Date.now()
          }),
          { TTL: 120, urgency: "high" }
        );
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }));

    return NextResponse.json({ sent, activeOrders: orders.length, recipients: userIds.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reminder fehlgeschlagen." }, { status: 500 });
  }
}
