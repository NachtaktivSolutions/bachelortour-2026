"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { useApp } from "./app-provider";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPrompt() {
  const { profile } = useApp();
  const [visible,setVisible]=useState(false);
  const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
  const [isIos,setIsIos]=useState(false);

  const storageKey=useMemo(()=>profile?.id?`firestarter-pwa-prompt-seen:${profile.id}`:"",[profile?.id]);

  useEffect(()=>{
    if(!profile||!storageKey)return;
    const standalone=window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & {standalone?:boolean}).standalone===true;
    if(standalone||localStorage.getItem(storageKey)==="1")return;

    const ua=window.navigator.userAgent;
    const ios=/iPad|iPhone|iPod/.test(ua) || (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    setIsIos(ios);

    const show=window.setTimeout(()=>{
      localStorage.setItem(storageKey,"1");
      setVisible(true);
    },1200);

    const beforeInstall=(event:Event)=>{
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt",beforeInstall);
    return()=>{window.clearTimeout(show);window.removeEventListener("beforeinstallprompt",beforeInstall)};
  },[profile,storageKey]);

  async function install(){
    if(!installEvent)return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setVisible(false);
    setInstallEvent(null);
  }

  if(!visible)return null;

  return <div className="pwa-install-backdrop" role="dialog" aria-modal="true" aria-label="Firestarter 2026 installieren">
    <section className="pwa-install-card">
      <button type="button" className="pwa-install-close" onClick={()=>setVisible(false)} aria-label="Schließen"><X/></button>
      <img src="/api/branding/icon" alt="Firestarter 2026" className="pwa-install-logo"/>
      <span className="eyebrow">SCHNELLER ZUR TOUR</span>
      <h2>Firestarter 2026 installieren</h2>
      <p>Speichere die App auf deinem Home-Bildschirm – für Vollbildansicht, Push-Nachrichten und schnellen Zugriff.</p>

      {installEvent?<button type="button" className="primary-button pwa-install-main" onClick={install}><Download/>Jetzt installieren</button>:isIos?<div className="pwa-ios-guide">
        <div><span>1</span><Share/><p>Unten in Safari auf <strong>Teilen</strong> tippen.</p></div>
        <div><span>2</span><Smartphone/><p><strong>Zum Home-Bildschirm</strong> auswählen.</p></div>
        <div><span>3</span><strong>＋</strong><p>Oben rechts mit <strong>Hinzufügen</strong> bestätigen.</p></div>
      </div>:<div className="pwa-generic-guide"><Smartphone/><p>Öffne das Browsermenü und wähle <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>.</p></div>}

      <button type="button" className="secondary-button pwa-install-later" onClick={()=>setVisible(false)}>Nicht jetzt</button>
    </section>
  </div>;
}
