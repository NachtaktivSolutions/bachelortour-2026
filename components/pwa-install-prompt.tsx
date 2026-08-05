"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
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

  useEffect(()=>{
    if(!profile)return;
    const standalone=window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & {standalone?:boolean}).standalone===true;
    if(standalone)return;

    const ua=window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) || (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1));

    const beforeInstall=(event:Event)=>{
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const installed=()=>{setVisible(false);window.setTimeout(()=>window.location.reload(),500)};
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",installed);
    const timer=window.setTimeout(()=>setVisible(true),700);
    return()=>{window.clearTimeout(timer);window.removeEventListener("beforeinstallprompt",beforeInstall);window.removeEventListener("appinstalled",installed)};
  },[profile]);

  async function install(){
    if(!installEvent)return;
    await installEvent.prompt();
    const choice=await installEvent.userChoice;
    if(choice.outcome==="accepted")setVisible(false);
  }

  if(!visible)return null;

  return <div className="pwa-install-backdrop" role="dialog" aria-modal="true" aria-label="Firestarter 2026 installieren">
    <section className="pwa-install-card simple-onboarding-card">
      <img src="/api/branding/icon" alt="Firestarter 2026" className="pwa-install-logo"/>
      <span className="eyebrow">SCHRITT 1 VON 3</span>
      <h2>App installieren</h2>
      <p>Bitte zuerst die App installieren. Danach führen wir dich automatisch durch Standort und Mitteilungen.</p>

      {installEvent?<button type="button" className="primary-button pwa-install-main" onClick={install}><Download/>App jetzt installieren</button>:isIos?<div className="pwa-ios-guide">
        <div><span>1</span><Share/><p>Unten auf <strong>Teilen</strong> tippen.</p></div>
        <div><span>2</span><Smartphone/><p><strong>Zum Home-Bildschirm</strong> wählen.</p></div>
        <div><span>3</span><strong>＋</strong><p>Mit <strong>Hinzufügen</strong> bestätigen.</p></div>
      </div>:<div className="pwa-generic-guide"><Smartphone/><p>Oben rechts auf <strong>⋮</strong> tippen und <strong>App installieren</strong> auswählen.</p></div>}

      <small className="onboarding-help">Danach die neue Firestarter-App vom Startbildschirm öffnen.</small>
    </section>
  </div>;
}
