"use client";

import { useEffect, useState } from "react";

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000)
  };
}

export function Countdown({ startsAt }: { startsAt?: string | null }) {
  const target = new Date(startsAt || process.env.NEXT_PUBLIC_EVENT_START || "2026-08-14T09:00:00+02:00");
  const [left, setLeft] = useState(diff(target));

  useEffect(() => {
    setLeft(diff(target));
    const timer = window.setInterval(() => setLeft(diff(target)), 30000);
    return () => window.clearInterval(timer);
  }, [startsAt]);

  return (
    <div className="countdown countdown-compact" aria-label={`${left.days} Tage, ${left.hours} Stunden und ${left.minutes} Minuten`}>
      <div><strong>{left.days}</strong><span>Tage</span></div>
      <div><strong>{left.hours}</strong><span>Std.</span></div>
      <div><strong>{left.minutes}</strong><span>Min.</span></div>
      <small>bis Firestarter 26</small>
    </div>
  );
}
