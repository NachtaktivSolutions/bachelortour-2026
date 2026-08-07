"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./countdown.module.css";

function getTarget(startsAt?: string | null) {
  const value = startsAt || process.env.NEXT_PUBLIC_EVENT_START || "2026-08-14T09:00:00+02:00";
  const target = new Date(value);
  return Number.isNaN(target.getTime()) ? new Date("2026-08-14T09:00:00+02:00") : target;
}

function diff(target: Date) {
  const rawMs = target.getTime() - Date.now();
  const ms = Math.max(0, rawMs);
  return {
    ended: rawMs <= 0,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000)
  };
}

function BusIcon() {
  return (
    <svg viewBox="0 0 96 58" role="img" aria-label="Bus" className={styles.busSvg}>
      <path d="M18 12h54c7 0 12 6 12 13v18H12V20c0-4 2-8 6-8Z" />
      <path d="M20 18h14v13H20zm19 0h15v13H39zm20 0h14v13H59z" />
      <path d="M12 36h72M10 43h76" />
      <circle cx="27" cy="45" r="7" />
      <circle cx="69" cy="45" r="7" />
      <path d="M7 36h5m72 0h5M17 12l5-6h43l7 6" />
    </svg>
  );
}

function TourRunning() {
  return (
    <div className={`${styles.tourRunning} tour-running`} aria-label="Firestarter 26 läuft. Der Bus rollt. Das Chaos auch.">
      <span className={styles.runningEyebrow}>FIRESTARTER 26 LÄUFT</span>
      <strong className={styles.runningText}>Der Bus rollt. Das Chaos auch. 😎</strong>
      <div className={styles.route} aria-hidden="true">
        <span className={`${styles.endpoint} ${styles.leaf}`}>🌿</span>
        <span className={styles.road} />
        <span className={styles.bus}><BusIcon /></span>
        <span className={`${styles.endpoint} ${styles.beer}`}>🍺</span>
      </div>
    </div>
  );
}

export function Countdown({ startsAt }: { startsAt?: string | null }) {
  const target = useMemo(() => getTarget(startsAt), [startsAt]);
  const [left, setLeft] = useState(() => diff(target));

  useEffect(() => {
    const update = () => setLeft(diff(target));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (left.ended) return <TourRunning />;

  return (
    <div className="countdown countdown-compact" aria-label={`${left.days} Tage, ${left.hours} Stunden und ${left.minutes} Minuten`}>
      <div><strong>{left.days}</strong><span>Tage</span></div>
      <div><strong>{left.hours}</strong><span>Std.</span></div>
      <div><strong>{left.minutes}</strong><span>Min.</span></div>
      <small>bis Firestarter 26</small>
    </div>
  );
}
