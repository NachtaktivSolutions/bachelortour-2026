"use client";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile } from "@/lib/types";

const pinIcon = L.divIcon({ className: "event-marker", html: "🔥", iconSize: [36,36] });
const userIcon = L.divIcon({ className: "user-marker", html: "👤", iconSize: [32,32] });

export function MapView({ pins, members }: { pins: MapPin[]; members: Profile[] }) {
  const center: [number, number] = pins[0] ? [pins[0].latitude, pins[0].longitude] : [48.7758, 9.1829];
  return (
    <MapContainer center={center} zoom={13} className="map-container">
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      {pins.map(p => <Marker key={p.id} position={[p.latitude,p.longitude]} icon={pinIcon}><Popup><strong>{p.title}</strong><br/>{p.description}</Popup></Marker>)}
      {members.filter(m => m.share_location && m.latitude && m.longitude).map(m =>
        <Marker key={m.id} position={[m.latitude!,m.longitude!]} icon={userIcon}><Popup><strong>{m.name}</strong><br/>Standort geteilt</Popup></Marker>
      )}
    </MapContainer>
  );
}
