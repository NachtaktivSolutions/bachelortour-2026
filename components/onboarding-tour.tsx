"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useApp } from "./app-provider";

type TourStep = {
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  placement?: "top" | "bottom";
};

const steps: TourStep[] = [
  {
    target: "[data-tour='brand']",
    eyebrow: "WILLKOMMEN",
    title: "Deine Tour beginnt hier",
    body: "Hier kommst du jederzeit zurück zur Startseite und siehst die wichtigsten Neuigkeiten zur Bachelortour.",
    placement: "bottom"
  },
  {
    target: "[data-tour='help']",
    eyebrow: "SCHNELLHILFE",
    title: "Alles Wichtige griffbereit",
    body: "Hier findest du Hilfe, Check-ins, deinen Status und wichtige Informationen für unterwegs.",
    placement: "bottom"
  },
  {
    target: "[data-tour='profile']",
    eyebrow: "DEIN PROFIL",
    title: "Mach die App zu deiner",
    body: "Über dein Bild bearbeitest du Namen, Foto und persönliche Angaben. Dort kannst du diese Tour später erneut starten.",
    placement: "bottom"
  },
  {
    target: "[data-tour='map']",
    eyebrow: "LIVE-KARTE",
    title: "Niemand geht verloren",
    body: "Auf der Karte findest du Treffpunkte, Programmpunkte und freigegebene Live-Standorte der Gruppe.",
    placement: "top"
  },
  {
    target: "[data-tour='chat']",
    eyebrow: "GRUPPENCHAT",
    title: "Bleibt miteinander verbunden",
    body: "Im Chat landen spontane Absprachen, Nachrichten und alles, was die Gruppe sofort wissen muss.",
    placement: "top"
  },
  {
    target: "[data-tour='gallery']",
    eyebrow: "FOTOS",
    title: "Beweise sammeln",
    body: "Hier lädst du Fotos hoch und siehst alle Bilder der Tour an einem Ort.",
    placement: "top"
  }
];

const STORAGE_VERSION = "v1";

export function OnboardingTour() {
  const { profile } = useApp();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [ready, setReady] = useState(false);
  const [spotlight, setSpotlight] = useState<React.CSSProperties>({ opacity: 0 });
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const storageKey = useMemo(
    () => `firestarter-onboarding-${STORAGE_VERSION}-${profile?.id ?? "guest"}`,
    [profile?.id]
  );

  const positionStep = useCallback(() => {
    if (!open || finishing) return;
    const step = steps[stepIndex];
    const element = document.querySelector(step.target) as HTMLElement | null;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const padding = 8;
    const radius = Math.min(24, Math.max(14, rect.height / 2));
    setSpotlight({
      opacity: 1,
      left: Math.max(8, rect.left - padding),
      top: Math.max(8, rect.top - padding),
      width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      height: rect.height + padding * 2,
      borderRadius: radius
    });

    const cardWidth = Math.min(390, window.innerWidth - 24);
    const estimatedHeight = 245;
    const preferredTop = step.placement === "top"
      ? rect.top - estimatedHeight - 18
      : rect.bottom + 18;
    const top = Math.max(14, Math.min(window.innerHeight - estimatedHeight - 14, preferredTop));
    const left = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, rect.left + rect.width / 2 - cardWidth / 2));
    setCardStyle({ opacity: 1, width: cardWidth, left, top });
    element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [finishing, open, stepIndex]);

  useEffect(() => {
    if (!profile || typeof window === "undefined") return;
    const hasSeenTour = window.localStorage.getItem(storageKey) === "done";
    const timer = window.setTimeout(() => {
      setReady(true);
      if (!hasSeenTour) setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [profile, storageKey]);

  useEffect(() => {
    const restart = () => {
      setStepIndex(0);
      setFinishing(false);
      setOpen(true);
    };
    window.addEventListener("restart-onboarding-tour", restart);
    return () => window.removeEventListener("restart-onboarding-tour", restart);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(positionStep);
    window.addEventListener("resize", positionStep);
    window.addEventListener("scroll", positionStep, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionStep);
      window.removeEventListener("scroll", positionStep, true);
    };
  }, [open, positionStep]);

  const complete = useCallback(() => {
    setFinishing(true);
    setSpotlight({ opacity: 0 });
    window.localStorage.setItem(storageKey, "done");
    window.setTimeout(() => setOpen(false), 1550);
  }, [storageKey]);

  const skip = useCallback(() => {
    window.localStorage.setItem(storageKey, "done");
    setOpen(false);
  }, [storageKey]);

  if (!ready || !open) return null;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const firstName = profile?.name?.trim().split(/\s+/)[0] || "Bachelor";

  return (
    <div className={`onboarding-layer${finishing ? " onboarding-finishing" : ""}`} role="dialog" aria-modal="true" aria-label="Einführung in die App">
      <div className="onboarding-dim" />
      <div className="onboarding-spotlight" style={spotlight} aria-hidden="true" />

      {!finishing && (
        <>
          <button className="onboarding-skip" onClick={skip} type="button">
            Überspringen <X size={16} />
          </button>
          <section className="onboarding-card" style={cardStyle}>
            <div className="onboarding-progress" aria-label={`Schritt ${stepIndex + 1} von ${steps.length}`}>
              {steps.map((_, index) => <span key={index} className={index <= stepIndex ? "active" : ""} />)}
            </div>
            <span className="eyebrow">{stepIndex === 0 ? `HALLO ${firstName.toUpperCase()}` : step.eyebrow}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-back" disabled={stepIndex === 0} onClick={() => setStepIndex(index => Math.max(0, index - 1))}>
                <ChevronLeft size={18} /> Zurück
              </button>
              <button type="button" className="onboarding-next" onClick={() => isLast ? complete() : setStepIndex(index => index + 1)}>
                {isLast ? <><Sparkles size={18} /> App öffnen</> : <>Weiter <ChevronRight size={18} /></>}
              </button>
            </div>
          </section>
        </>
      )}

      {finishing && (
        <div className="onboarding-portal" aria-live="polite">
          <div className="portal-ring ring-one" />
          <div className="portal-ring ring-two" />
          <div className="portal-ring ring-three" />
          <div className="portal-core"><Sparkles size={34} /><strong>Firestarter 2026</strong><span>Die Tour ist eröffnet.</span></div>
        </div>
      )}
    </div>
  );
}
