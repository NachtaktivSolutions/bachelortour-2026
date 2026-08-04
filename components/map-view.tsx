"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const eventIcon = L.divIcon({ className: "map-marker event-map-marker", html: "<span>🔥</span>", iconSize: [42,42], iconAnchor: [21,42] });
const userIcon = L.divIcon({ className: "map-marker user-map-marker", html: "<span>👤</span>", iconSize: [38,38], iconAnchor: [19,38] });
const ownIcon = L.divIcon({ className: "map-marker own-map-marker", html: "<span>📍</span>", iconSize: [42,42], iconAnchor: [21,42] });

type Props = {
  pins: MapPin[];
  programItems: ProgramItem[];
  members: Profile[];
};

export function MapView({ pins, programItems, members }: Props) {
  const { profile } = useApp();
  const points: [number, number][] = [
    ...pins.map(p => [p.latitude, p.longitude] as [number, number]),
    ...programItems.filter(p => p.latitude != null && p.longitude != null).map(p => [p.latitude!, p.longitude!] as [number, number]),
    ...members.filter(m => m.latitude != null && m.longitude != null).map(m => [m.latitude!, m.longitude!] as [number, number])
  ];

  const center: [number, number] =
    profile?.latitude != null && profile?.longitude != null
      ? [profile.latitude, profile.longitude]
      : points[0] ?? [48.6778281, 9.21833];

  return (
    <MapContainer center={center} zoom={14} className="map-container">
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <FitMap points={points}/>

      {programItems.filter(item => item.latitude != null && item.longitude != null).map(item => (
        <Marker key={`program-${item.id}`} position={[item.latitude!, item.longitude!]} icon={eventIcon}>
          <Popup>
            <div className="map-popup">
              <strong>{item.title}</strong>
              {item.starts_at && <small>{new Date(item.starts_at).toLocaleString("de-DE")}</small>}
              {item.description && <p>{item.description}</p>}
              {item.address && <span>{item.address}</span>}
              <a target="_blank" href={navigationUrl(item.latitude!, item.longitude!, item.address)}>Dorthin navigieren</a>
            </div>
          </Popup>
        </Marker>
      ))}

      {pins.map(pin => (
        <Marker key={`pin-${pin.id}`} position={[pin.latitude,pin.longitude]} icon={eventIcon}>
          <Popup>
            <div className="map-popup">
              <strong>{pin.title}</strong>
              {pin.description && <p>{pin.description}</p>}
              {pin.address && <span>{pin.address}</span>}
              <a target="_blank" href={navigationUrl(pin.latitude, pin.longitude, pin.address)}>Dorthin navigieren</a>
            </div>
          </Popup>
        </Marker>
      ))}

      {members.filter(m => m.share_location && m.latitude != null && m.longitude != null).map(member => {
        const own = member.id === profile?.id;
        return (
          <Marker key={`member-${member.id}`} position={[member.latitude!,member.longitude!]} icon={own ? ownIcon : userIcon}>
            <Popup>
              <div className="map-popup">
                <strong>{own ? "Mein Standort" : member.name}</strong>
                <small>{member.location_updated_at ? `Aktualisiert: ${new Date(member.location_updated_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}` : "Standort geteilt"}</small>
                {!own && member.phone && <a href={`tel:${member.phone}`}>Anrufen</a>}
                <a target="_blank" href={navigationUrl(member.latitude!, member.longitude!)}>Dorthin navigieren</a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function FitMap({ points }: { points: [number,number][] }) {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 50);
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [45,45], maxZoom: 16 });
  }, [map, JSON.stringify(points)]);
  return null;
}

function navigationUrl(latitude: number, longitude: number, address?: string | null) {
  const destination = address?.trim() || `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
