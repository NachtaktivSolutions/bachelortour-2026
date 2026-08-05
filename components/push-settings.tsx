"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, Check, LocateFixed, MapPin, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type PushState="loading"|"unsupported"|"blocked"|"disabled"|"enabled"|"missing-config";
type SetupStep="location"|"push"|"blocked"|"unsupported"|"done";
const PUSH_REPAIR_VERSION="android-v3";

export function PushBootstrap(){
  const {session,profile,refreshProfile}=useApp();
  const [visible,setVisible]=useState(false);
  const [step,setStep]=useState<SetupStep>("location");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const setupKey=useMemo(()=>session?.user.id?`firestarter-device-setup-v2:${session.user.id}`:"",[session?.user.id]);

  useEffect(()=>{
    if(!session||!profile||typeof window==="undefined"||!setupKey)return;
    const installed=isStandalone();
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if(supportsPush()&&Notification.permission==="granted")ensurePushSubscription(session.user.id).catch(console.error);
    if(mobile&&!installed)return;
    if(localStorage.getItem(setupKey)==="done")return;

    let next:Exclude<SetupStep,"done">;
    if(!profile.share_location&&"geolocation" in navigator)next="location";
    else if(!supportsPush())next="unsupported";
    else if(Notification.permission==="denied")next="blocked";
    else next="push";
    setStep(next);
    const timer=window.setTimeout(()=>setVisible(true),700);
    return()=>window.clearTimeout(timer);
  },[session,profile,setupKey]);

  async function enableLocation(){
    if(!profile)return;
    setBusy(true);setError("");
    try{
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
      const supabase=createClient();
      const {error:saveError}=await supabase.from("profiles").update({share_location:true,latitude:position.coords.latitude,longitude:position.coords.longitude,location_updated_at:new Date().toISOString()}).eq("id",profile.id);
      if(saveError)throw saveError;
      await refreshProfile();
      goToPush();
    }catch(err){
      const geo=err as Partial<GeolocationPositionError>;
      if(typeof geo.code==="number"){
        if(geo.code===1)setError("Standort wurde blockiert. Bitte bei der Geräte-Abfrage auf „Zulassen“ tippen.");
        else if(geo.code===3)setError("Die Standortabfrage hat zu lange gedauert. Bitte noch einmal versuchen.");
        else setError("Der Standort ist gerade nicht verfügbar.");
      }else setError(err instanceof Error?err.message:"Standort konnte nicht aktiviert werden.");
    }finally{setBusy(false)}
  }

  function goToPush(){
    setError("");
    if(!supportsPush())setStep("unsupported");
    else if(Notification.permission==="denied")setStep("blocked");
    else setStep("push");
  }

  async function activatePush(){
    if(!session)return;
    setBusy(true);setError("");
    try{await enablePush(session.user.id);finishSetup()}
    catch(err){setError(err instanceof Error?err.message:"Push konnte nicht aktiviert werden.");if(supportsPush()&&Notification.permission==="denied")setStep("blocked")}
    finally{setBusy(false)}
  }

  function finishSetup(){if(setupKey)localStorage.setItem(setupKey,"done");setStep("done");setVisible(false)}
  if(!visible||!session||!profile)return null;
  const number=step==="location"?"1 von 2":"2 von 2";

  return <div className="push-consent-backdrop setup-wizard-backdrop" role="dialog" aria-modal="true" aria-labelledby="device-setup-title"><section className="push-consent-card setup-wizard-card">
    <button className="push-consent-close" onClick={finishSetup} aria-label="Schließen"><X/></button>
    <div className="setup-progress"><span>{number}</span><i className={step!=="location"?"complete":""}/><i className={step!=="location"?"active":""}/></div>
    {step==="location"&&<><div className="push-consent-icon"><LocateFixed/></div><span className="eyebrow">SCHRITT 1</span><h2 id="device-setup-title">Standort einschalten</h2><p>Damit die anderen dich auf der Live-Karte sehen können. Tippe danach bei der Geräte-Abfrage auf <strong>„Zulassen“</strong>.</p>{error&&<div className="error">{error}</div>}<button className="primary-button setup-main-button" onClick={enableLocation} disabled={busy}><MapPin/>{busy?"Standort wird geprüft …":"Standort erlauben"}</button><button className="push-later-button" onClick={goToPush}>Ohne Standort weiter</button></>}
    {step==="push"&&<><div className="push-consent-icon"><BellRing/></div><span className="eyebrow">SCHRITT 2</span><h2 id="device-setup-title">Nachrichten erlauben</h2><p>So bekommst du Treffpunkte und wichtige Änderungen. Tippe danach bei der Geräte-Abfrage auf <strong>„Zulassen“</strong>.</p>{error&&<div className="error">{error}</div>}<button className="primary-button setup-main-button" onClick={activatePush} disabled={busy}><BellRing/>{busy?"Wird aktiviert …":"Push erlauben"}</button><button className="push-later-button" onClick={finishSetup}>Später machen</button></>}
    {step==="blocked"&&<><div className="push-consent-icon warning"><BellOff/></div><span className="eyebrow">BENACHRICHTIGUNGEN BLOCKIERT</span><h2 id="device-setup-title">Push wieder freigeben</h2><p>Öffne die App- oder Website-Einstellungen deines Handys und stelle <strong>Benachrichtigungen auf „Zulassen“</strong>.</p><div className="setup-browser-hint">Android: App-Symbol gedrückt halten → App-Info → Benachrichtigungen<br/>iPhone: Einstellungen → Mitteilungen → Firestarter 2026</div><button className="primary-button setup-main-button" onClick={()=>window.location.reload()}>Erneut prüfen</button><button className="push-later-button" onClick={finishSetup}>Später machen</button></>}
    {step==="unsupported"&&<><div className="push-consent-icon warning"><BellOff/></div><span className="eyebrow">FAST FERTIG</span><h2 id="device-setup-title">Push hier nicht verfügbar</h2><p>Die App funktioniert trotzdem vollständig. Für Benachrichtigungen installiere sie auf Android mit Chrome oder Samsung Internet, auf dem iPhone mit Safari.</p><button className="primary-button setup-main-button" onClick={finishSetup}><Check/>App verwenden</button></>}
  </section></div>;
}

export function PushProfileSetting(){
  const {session}=useApp();const [state,setState]=useState<PushState>("loading");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const refresh=useCallback(async()=>setState(await getPushState()),[]);useEffect(()=>{refresh()},[refresh]);
  async function toggle(){if(!session)return;setBusy(true);setMessage("");try{if(state==="enabled"){await disablePush(session.user.id);setMessage("Push-Nachrichten wurden deaktiviert.")}else{await enablePush(session.user.id);setMessage("Push-Nachrichten sind aktiviert.")}await refresh()}catch(err){setMessage(err instanceof Error?err.message:"Änderung fehlgeschlagen.");await refresh()}finally{setBusy(false)}}
  const enabled=state==="enabled";const disabled=busy||state==="unsupported"||state==="missing-config";
  return <section className="profile-setting-card"><div className={`profile-setting-icon ${enabled?"active":""}`}>{enabled?<BellRing/>:<BellOff/>}</div><div className="profile-setting-copy"><h3>Push-Nachrichten</h3><p>{pushStateText(state)}</p>{message&&<small>{message}</small>}</div><button className={`toggle-switch ${enabled?"on":""}`} onClick={toggle} disabled={disabled} aria-pressed={enabled}><span/></button></section>
}

function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true}
function supportsPush(){return typeof window!=="undefined"&&"Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window&&Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
async function getPushState():Promise<PushState>{if(typeof window==="undefined")return"loading";if(!("Notification"in window)||!("serviceWorker"in navigator)||!("PushManager"in window))return"unsupported";if(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)return"missing-config";if(Notification.permission==="denied")return"blocked";if(Notification.permission!=="granted")return"disabled";const registration=await getRegistration();return await registration.pushManager.getSubscription()?"enabled":"disabled"}
async function getRegistration(){const existing=await navigator.serviceWorker.getRegistration("/");const registration=existing??await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});try{await registration.update()}catch{}return await navigator.serviceWorker.ready}
async function ensurePushSubscription(userId:string){const registration=await getRegistration();let subscription=await registration.pushManager.getSubscription();const android=/Android/i.test(navigator.userAgent);const repairKey=`firestarter_push_repair_${PUSH_REPAIR_VERSION}`;if(android&&localStorage.getItem(repairKey)!=="done"){if(subscription){try{await subscription.unsubscribe()}catch{}}subscription=null;localStorage.setItem(repairKey,"done")}if(!subscription)subscription=await createSubscription(registration);await saveSubscription(userId,subscription)}
async function enablePush(userId:string){if(!supportsPush())throw new Error("Dieser Browser unterstützt Push nicht.");const permission=await Notification.requestPermission();if(permission==="denied")throw new Error("Benachrichtigungen wurden blockiert.");if(permission!=="granted")throw new Error("Benachrichtigungen wurden nicht erlaubt.");const registration=await getRegistration();let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await createSubscription(registration);await saveSubscription(userId,subscription)}
async function createSubscription(registration:ServiceWorkerRegistration){return await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)})}
async function disablePush(userId:string){if(!("serviceWorker"in navigator))return;const registration=await getRegistration();const subscription=await registration.pushManager.getSubscription();const endpoint=subscription?.endpoint;if(subscription)await subscription.unsubscribe();const supabase=createClient();const query=supabase.from("push_subscriptions").delete().eq("user_id",userId);const {error}=endpoint?await query.eq("endpoint",endpoint):await query;if(error)throw error}
async function saveSubscription(userId:string,subscription:PushSubscription){const supabase=createClient();const {error}=await supabase.from("push_subscriptions").upsert({user_id:userId,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:"endpoint"});if(error)throw new Error(`Registrierung konnte nicht gespeichert werden: ${error.message}`)}
function pushStateText(state:PushState){if(state==="enabled")return"Aktiv – wichtige Nachrichten werden auf diesem Gerät angezeigt.";if(state==="blocked")return"Im Browser blockiert. Bitte über die App- oder Website-Einstellungen freigeben.";if(state==="unsupported")return"Dieser Browser unterstützt keine Web-Push-Nachrichten.";if(state==="missing-config")return"Push ist serverseitig noch nicht vollständig eingerichtet.";if(state==="loading")return"Status wird geprüft …";return"Deaktiviert – du erhältst auf diesem Gerät keine Push-Nachrichten."}
function urlBase64ToUint8Array(base64String:string){const padding="=".repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...atob(base64)].map(char=>char.charCodeAt(0)))}
