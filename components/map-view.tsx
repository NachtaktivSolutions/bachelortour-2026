"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const eventIcon = L.divIcon({ className: "map-marker event-map-marker", html: "<span>🔥</span>", iconSize: [42,42], iconAnchor: [21,42] });
const STALE_AFTER_MS = 30 * 60 * 1000;

type Props = { pins: MapPin[]; programItems: ProgramItem[]; members: Profile[] };

export function MapView({ pins, programItems, members }: Props) {
  const { profile } = useApp();
  const points: [number, number][] = [
    ...pins.map(p => [p.latitude, p.longitude] as [number, number]),
    ...programItems.filter(p => p.latitude != null && p.longitude != null).map(p => [p.latitude!, p.longitude!] as [number, number]),
    ...members.filter(m => m.latitude != null && m.longitude != null).map(m => [m.latitude!, m.longitude!] as [number, number])
  ];
  const center: [number, number] = profile?.latitude != null && profile?.longitude != null ? [profile.latitude, profile.longitude] : points[0] ?? [48.6778281, 9.21833];

  return <MapContainer center={center} zoom={14} className="map-container">
    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <FitMap points={points}/>
    {programItems.filter(item => item.latitude != null && item.longitude != null).map(item => <Marker key={`program-${item.id}`} position={[item.latitude!, item.longitude!]} icon={eventIcon}><Popup><div className="map-popup"><strong>{item.title}</strong>{item.starts_at&&<small>{formatBerlin(item.starts_at)}</small>}{item.description&&<p>{item.description}</p>}{item.address&&<span>{item.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(item.latitude!,item.longitude!,item.address)}>Dorthin navigieren</a></div></Popup></Marker>)}
    {pins.map(pin => <Marker key={`pin-${pin.id}`} position={[pin.latitude,pin.longitude]} icon={eventIcon}><Popup><div className="map-popup"><strong>{pin.title}</strong>{pin.description&&<p>{pin.description}</p>}{pin.address&&<span>{pin.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(pin.latitude,pin.longitude,pin.address)}>Dorthin navigieren</a></div></Popup></Marker>)}
    {members.filter(m => m.share_location && m.latitude != null && m.longitude != null).map(member => {
      const own=member.id===profile?.id;const stale=isStale(member.location_updated_at);
      return <Marker key={`member-${member.id}`} position={[member.latitude!,member.longitude!]} icon={memberIcon(member,own,stale)}><Popup><div className="map-popup"><strong>{own?"Mein Standort":member.name}</strong>{member.participant_status&&<span className={`participant-status status-${statusSlug(member.participant_status)}`}>{member.participant_status}</span>}<small>{member.location_updated_at?`${stale?"Nicht aktuell · ":"Aktualisiert: "}${formatBerlin(member.location_updated_at,true)}`:"Standort geteilt"}</small>{stale&&<p>Dieser Standort wurde seit mehr als 30 Minuten nicht aktualisiert.</p>}{!own&&member.phone&&<a href={`tel:${member.phone}`}>Anrufen</a>}<a target="_blank" rel="noreferrer" href={navigationUrl(member.latitude!,member.longitude!)}>Dorthin navigieren</a></div></Popup></Marker>;
    })}
  </MapContainer>;
}

function FitMap({points}:{points:[number,number][]}){const map=useMap();const key=useMemo(()=>JSON.stringify(points),[points]);useEffect(()=>{const timer=window.setTimeout(()=>{map.invalidateSize();if(!points.length)return;if(points.length===1)map.setView(points[0],15);else map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[35,35],paddingBottomRight:[35,115],maxZoom:16})},120);return()=>window.clearTimeout(timer)},[map,key]);return null}
function memberIcon(member:Profile,own:boolean,stale:boolean){const initials=member.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?";const content=member.avatar_url?`<img src="${escapeHtml(member.avatar_url)}" alt=""/>`:`<span>${escapeHtml(initials)}</span>`;return L.divIcon({className:`map-marker profile-map-marker${own?" own":""}${stale?" stale":""}`,html:`<div style="${stale?"filter:grayscale(1);opacity:.58;":""}">${content}</div>`,iconSize:[46,46],iconAnchor:[23,46]})}
function isStale(value?:string|null){if(!value)return true;return Date.now()-new Date(value).getTime()>STALE_AFTER_MS}
function escapeHtml(value:string){return value.replace(/[&<>'\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[char]||char))}
function navigationUrl(latitude:number,longitude:number,address?:string|null){const destination=address?.trim()||`${latitude},${longitude}`;return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
function formatBerlin(value:string,timeOnly=false){return new Intl.DateTimeFormat("de-DE",timeOnly?{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit"}:{timeZone:"Europe/Berlin",dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
function statusSlug(value:string){return value.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-")}
