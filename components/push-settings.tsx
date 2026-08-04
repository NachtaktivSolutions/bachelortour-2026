"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type PushState = "loading" | "unsupported" | "blocked" | "disabled" | "enabled" | "missing-config";
const PUSH_REPAIR_VERSION="android-v2";

export function PushBootstrap() {
  const { session } = useApp();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session || typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const dismissed = localStorage.getItem("firestarter_push_prompt_dismissed");
    if (Notification.permission === "default" && dismissed !== "yes") {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }

    if (Notification.permission === "granted") {
      ensurePushSubscription(session.user.id).catch(console.error);
    }
  }, [session]);

  async function activate() {
    if (!session) return;
    setBusy(true); setError("");
    try { await enablePush(session.user.id); setVisible(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Push konnte nicht aktiviert werden."); }
    finally { setBusy(false); }
  }

  function later() { localStorage.setItem("firestarter_push_prompt_dismissed", "yes"); setVisible(false); }
  if (!visible) return null;

  return <div className="push-consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="push-consent-title"><section className="push-consent-card">
    <button className="push-consent-close" onClick={later} aria-label="Später"><X /></button>
    <div className="push-consent-icon"><BellRing /></div><span className="eyebrow">NICHTS VERPASSEN</span>
    <h2 id="push-consent-title">Push-Nachrichten aktivieren?</h2>
    <p>Du erhältst wichtige Tour-News, Treffpunkte und kurzfristige Änderungen direkt aufs Handy.</p>
    {error && <div className="error">{error}</div>}
    <button className="primary-button" onClick={activate} disabled={busy}>{busy ? "Wird aktiviert …" : "Push aktivieren"}</button>
    <button className="push-later-button" onClick={later}>Später entscheiden</button>
  </section></div>;
}

export function PushProfileSetting() {
  const { session } = useApp();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => setState(await getPushState()), []);
  useEffect(() => { refresh(); }, [refresh]);

  async function toggle() {
    if (!session) return;
    setBusy(true); setMessage("");
    try {
      if (state === "enabled") {
        await disablePush(session.user.id);
        localStorage.setItem("firestarter_push_prompt_dismissed", "yes");
        setMessage("Push-Nachrichten wurden deaktiviert.");
      } else {
        await enablePush(session.user.id);
        localStorage.removeItem("firestarter_push_prompt_dismissed");
        setMessage("Push-Nachrichten sind aktiviert.");
      }
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Änderung fehlgeschlagen.");
      await refresh();
    } finally { setBusy(false); }
  }

  const enabled = state === "enabled";
  const disabled = busy || state === "unsupported" || state === "missing-config";
  return <section className="profile-setting-card"><div className={`profile-setting-icon ${enabled ? "active" : ""}`}>{enabled ? <BellRing /> : <BellOff />}</div>
    <div className="profile-setting-copy"><h3>Push-Nachrichten</h3><p>{pushStateText(state)}</p>{message && <small>{message}</small>}</div>
    <button className={`toggle-switch ${enabled ? "on" : ""}`} onClick={toggle} disabled={disabled} aria-pressed={enabled}><span /></button>
  </section>;
}

async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "loading";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "missing-config";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "disabled";
  const registration = await getRegistration();
  return await registration.pushManager.getSubscription() ? "enabled" : "disabled";
}

async function getRegistration() {
  const existing=await navigator.serviceWorker.getRegistration("/");
  const registration=existing ?? await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
  try { await registration.update(); } catch {}
  return await navigator.serviceWorker.ready;
}

async function ensurePushSubscription(userId: string) {
  const registration=await getRegistration();
  let subscription=await registration.pushManager.getSubscription();
  const android=/Android/i.test(navigator.userAgent);
  const repairKey=`firestarter_push_repair_${PUSH_REPAIR_VERSION}`;
  if(android && localStorage.getItem(repairKey)!=="done") {
    if(subscription) { try { await subscription.unsubscribe(); } catch {} }
    subscription=null;
    localStorage.setItem(repairKey,"done");
  }
  if(!subscription) subscription=await createSubscription(registration);
  await saveSubscription(userId,subscription);
}

async function enablePush(userId: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push wird auf diesem Browser nicht unterstützt.");
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error("Push ist noch nicht eingerichtet: öffentlicher VAPID-Schlüssel fehlt.");
  const permission = await Notification.requestPermission();
  if (permission === "denied") throw new Error("Push wurde im Browser blockiert. Bitte in den Website-Einstellungen wieder erlauben.");
  if (permission !== "granted") throw new Error("Push wurde nicht erlaubt.");
  const registration=await getRegistration();
  let subscription=await registration.pushManager.getSubscription();
  if (!subscription) subscription=await createSubscription(registration);
  await saveSubscription(userId, subscription);
}

async function createSubscription(registration:ServiceWorkerRegistration){
  return await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)});
}

async function disablePush(userId: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration=await getRegistration();
  const subscription=await registration.pushManager.getSubscription();
  const endpoint=subscription?.endpoint;
  if (subscription) await subscription.unsubscribe();
  const supabase=createClient();
  const query=supabase.from("push_subscriptions").delete().eq("user_id",userId);
  const {error}=endpoint?await query.eq("endpoint",endpoint):await query;
  if(error)throw error;
}

async function saveSubscription(userId: string, subscription: PushSubscription) {
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert({user_id:userId,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:"endpoint"});
  if (error) throw error;
}

function pushStateText(state: PushState) {
  if (state === "enabled") return "Aktiv – wichtige Nachrichten werden auf diesem Gerät angezeigt.";
  if (state === "blocked") return "Im Browser blockiert. Bitte über die Website-Einstellungen wieder freigeben.";
  if (state === "unsupported") return "Dieser Browser unterstützt keine Web-Push-Nachrichten.";
  if (state === "missing-config") return "Push ist serverseitig noch nicht vollständig eingerichtet.";
  if (state === "loading") return "Status wird geprüft …";
  return "Deaktiviert – du erhältst auf diesem Gerät keine Push-Nachrichten.";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map(char => char.charCodeAt(0)));
}
