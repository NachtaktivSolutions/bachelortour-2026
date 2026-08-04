"use client";

import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";
import { useState } from "react";

export function PushEnable() {
  const { session } = useApp();
  const [status, setStatus] = useState<"idle"|"busy"|"ok"|"error">("idle");
  const supabase = createClient();

  async function enable() {
    try {
      setStatus("busy");
      if (!session) throw new Error("Nicht angemeldet.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push wird auf diesem Browser nicht unterstützt.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Push wurde nicht erlaubt.");
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push ist noch nicht konfiguriert.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: session.user.id,
        subscription: subscription.toJSON()
      }, { onConflict: "user_id" });
      if (error) throw error;
      setStatus("ok");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  return (
    <button className={`push-enable ${status}`} onClick={enable} disabled={status === "busy" || status === "ok"}>
      <BellRing size={18}/>
      {status === "busy" ? "Wird aktiviert …" : status === "ok" ? "Push aktiviert" : status === "error" ? "Push nicht verfügbar" : "Push aktivieren"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}
