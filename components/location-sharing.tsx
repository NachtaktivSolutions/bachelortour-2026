"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";
import { LocateFixed } from "lucide-react";

const ACTIVE_UPDATE_INTERVAL_MS = 10_000;

export function LocationSharing() {
  const { profile, refreshProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const intervalId = useRef<number | null>(null);
  const requestRunning = useRef(false);
  const supabase = createClient();

  const savePosition = useCallback(async (position: GeolocationPosition) => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({
      share_location: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      location_updated_at: new Date().toISOString()
    }).eq("id", profile.id);

    if (error) throw error;
    setMessage("Standort aktualisiert");
  }, [profile, supabase]);

  const requestPosition = useCallback(() => {
    if (!profile?.share_location || !navigator.geolocation || document.visibilityState !== "visible" || requestRunning.current) return;
    requestRunning.current = true;
    navigator.geolocation.getCurrentPosition(
      position => {
        savePosition(position).catch(error => setMessage(error.message)).finally(() => { requestRunning.current = false; });
      },
      error => {
        requestRunning.current = false;
        setMessage(locationError(error));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 9_000 }
    );
  }, [profile?.share_location, savePosition]);

  useEffect(() => {
    if (!profile?.share_location || !navigator.geolocation) return;

    const startActiveUpdates = () => {
      if (document.visibilityState !== "visible") return;
      requestPosition();
      if (intervalId.current !== null) window.clearInterval(intervalId.current);
      intervalId.current = window.setInterval(requestPosition, ACTIVE_UPDATE_INTERVAL_MS);
    };

    const stopActiveUpdates = () => {
      if (intervalId.current !== null) {
        window.clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") startActiveUpdates();
      else stopActiveUpdates();
    };

    startActiveUpdates();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", startActiveUpdates);

    return () => {
      stopActiveUpdates();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", startActiveUpdates);
    };
  }, [profile?.share_location, requestPosition]);

  const toggle = async () => {
    if (!profile) return;
    if (!navigator.geolocation) {
      setMessage("Standort wird von diesem Gerät nicht unterstützt.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      if (profile.share_location) {
        const { error } = await supabase.from("profiles").update({
          share_location: false,
          latitude: null,
          longitude: null,
          location_updated_at: null
        }).eq("id", profile.id);
        if (error) throw error;
        setMessage("Standortfreigabe beendet");
      } else {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            position => savePosition(position).then(resolve).catch(reject),
            reject,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
          );
        });
      }
      await refreshProfile();
    } catch (error) {
      if (error instanceof GeolocationPositionError) setMessage(locationError(error));
      else setMessage(error instanceof Error ? error.message : "Standort konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="location-control">
      <button className={`location-toggle ${profile?.share_location ? "on" : ""}`} onClick={toggle} disabled={busy}>
        <LocateFixed size={18}/>
        {busy ? "Standort wird geprüft …" : profile?.share_location ? "Standort wird geteilt" : "Standort teilen"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

function locationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Standortfreigabe wurde im Browser blockiert.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Standort ist momentan nicht verfügbar.";
  if (error.code === error.TIMEOUT) return "Standortabfrage hat zu lange gedauert.";
  return "Standort konnte nicht ermittelt werden.";
}
