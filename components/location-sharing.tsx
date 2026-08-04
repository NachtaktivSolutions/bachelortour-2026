"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";
import { LocateFixed } from "lucide-react";

export function LocationSharing() {
  const { profile, refreshProfile } = useApp();
  const [busy, setBusy] = useState(false);
  const watchId = useRef<number | null>(null);
  const supabase = createClient();

  const updateLocation = (position: GeolocationPosition) => {
    supabase.from("profiles").update({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      location_updated_at: new Date().toISOString()
    }).eq("id", profile!.id);
  };

  useEffect(() => {
    if (!profile?.share_location || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(updateLocation, console.warn, {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 15000
    });
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [profile?.share_location, profile?.id]);

  const toggle = async () => {
    if (!profile) return;
    setBusy(true);
    const next = !profile.share_location;
    await supabase.from("profiles").update({ share_location: next }).eq("id", profile.id);
    if (!next) {
      await supabase.from("profiles").update({ latitude: null, longitude: null, location_updated_at: null }).eq("id", profile.id);
    } else {
      navigator.geolocation?.getCurrentPosition(updateLocation, alert, { enableHighAccuracy: true });
    }
    await refreshProfile();
    setBusy(false);
  };

  return (
    <button className={`location-toggle ${profile?.share_location ? "on" : ""}`} onClick={toggle} disabled={busy}>
      <LocateFixed size={18}/>{profile?.share_location ? "Standort wird geteilt" : "Standort teilen"}
    </button>
  );
}
