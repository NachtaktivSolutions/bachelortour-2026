import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, service);

  const supplied = req.headers.get("x-scheduler-token");
  const { data: config } = await admin.from("scheduler_config").select("token").eq("id", 1).single();
  if (!supplied || !config?.token || supplied !== config.token) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { data: jobs, error } = await admin
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for")
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let processed = 0;

  for (const job of jobs ?? []) {
    await admin.from("scheduled_jobs").update({ status: "processing", error: null }).eq("id", job.id).eq("status", "pending");
    try {
      if (job.job_type === "news") {
        const { error: insertError } = await admin.from("news").insert(job.payload);
        if (insertError) throw insertError;
        if (job.payload.send_push) await sendPush(admin, job.payload.title, job.payload.body, "/");
      } else if (job.job_type === "program") {
        const payload = { ...job.payload };
        const sendPushAfter = Boolean(payload.send_push);
        delete payload.send_push;
        const { error: insertError } = await admin.from("program_items").insert(payload);
        if (insertError) throw insertError;
        if (sendPushAfter) await sendPush(admin, `Programm: ${payload.title}`, payload.description || "Neuer Programmpunkt", "/program");
      } else if (job.job_type === "push") {
        await sendPush(admin, job.payload.title, job.payload.body, job.payload.url || "/");
      }
      await admin.from("scheduled_jobs").update({ status: "published", processed_at: new Date().toISOString() }).eq("id", job.id);
      processed += 1;
    } catch (jobError) {
      await admin.from("scheduled_jobs").update({ status: "failed", processed_at: new Date().toISOString(), error: jobError instanceof Error ? jobError.message : "Unbekannter Fehler" }).eq("id", job.id);
    }
  }

  return NextResponse.json({ processed });
}

async function sendPush(admin: ReturnType<typeof createClient>, title: string, body: string, targetUrl: string) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:dennis.haag@hotmail.de";
  if (!vapidPublic || !vapidPrivate) throw new Error("VAPID-Schlüssel fehlen.");
  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
  const { data: subscriptions } = await admin.from("push_subscriptions").select("*");
  await Promise.all((subscriptions ?? []).map(async subscription => {
    try {
      await webpush.sendNotification(subscription.subscription, JSON.stringify({ title, body, url: targetUrl }));
    } catch (pushError: any) {
      if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }));
}
