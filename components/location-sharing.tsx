"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";
import { LocateFixed } from "lucide-react";

export function LocationSharing() {
  const { profile, refreshProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const watchId = useRef<number | null>(null);
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

  useEffect(() => {
    if (!profile?.share_location || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      position => savePosition(position).catch(error => setMessage(error.message)),
      error => setMessage(locationError(error)),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    watchId.current = navigator.geolocation.watchPosition(
      position => savePosition(position).catch(error => setMessage(error.message)),
      error => setMessage(locationError(error)),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [profile?.share_location, savePosition]);

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
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
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
