"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const eventIcon=L.divIcon({className:"map-marker event-map-marker",html:"<span>🔥</span>",iconSize:[42,42],iconAnchor:[21,42]});
const STALE_AFTER_MS=30*60*1000;
type Props={pins:MapPin[];programItems:ProgramItem[];members:Profile[]};

export function MapView({pins,programItems,members}:Props){
  const {profile}=useApp();
  const visibleMembers=members.filter(m=>m.share_location&&m.latitude!=null&&m.longitude!=null);
  const points:[number,number][]= [...pins.map(p=>[p.latitude,p.longitude] as [number,number]),...programItems.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>[p.latitude!,p.longitude!] as [number,number]),...visibleMembers.map(m=>[m.latitude!,m.longitude!] as [number,number])];
  const center:[number,number]=profile?.latitude!=null&&profile?.longitude!=null?[profile.latitude,profile.longitude]:points[0]??[48.6778281,9.21833];
  const orderedMembers=[...visibleMembers].sort((a,b)=>Number(statusClass(a.participant_status||"")==="status-help")-Number(statusClass(b.participant_status||"")==="status-help"));

  return <MapContainer center={center} zoom={14} className="map-container">
    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><FitMap points={points}/>
    {programItems.filter(item=>item.latitude!=null&&item.longitude!=null).map(item=><Marker key={`program-${item.id}`} position={[item.latitude!,item.longitude!]} icon={eventIcon} zIndexOffset={300}><Popup><div className="map-popup"><strong>{item.title}</strong>{item.starts_at&&<small>{formatBerlin(item.starts_at)}</small>}{item.description&&<p>{item.description}</p>}{item.address&&<span>{item.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(item.latitude!,item.longitude!,item.address)}>Dorthin navigieren</a></div></Popup></Marker>)}
    {pins.map(pin=><Marker key={`pin-${pin.id}`} position={[pin.latitude,pin.longitude]} icon={eventIcon} zIndexOffset={350}><Popup><div className="map-popup"><strong>{pin.title}</strong>{pin.description&&<p>{pin.description}</p>}{pin.address&&<span>{pin.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(pin.latitude,pin.longitude,pin.address)}>Dorthin navigieren</a></div></Popup></Marker>)}
    {orderedMembers.map(member=>{const own=member.id===profile?.id;const stale=isStale(member.location_updated_at);const status=member.participant_status||"kein Status";const help=statusClass(status)==="status-help";return <Marker key={`member-${member.id}`} position={[member.latitude!,member.longitude!]} icon={memberIcon(member,own,stale)} zIndexOffset={help?1000:own?700:500}><Popup><div className="map-popup member-map-popup"><div className="member-popup-head"><span className="member-popup-avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<b>{initials(member.name)}</b>}</span><div><strong>{own?"Mein Standort":member.name}</strong><span className={`map-status-badge ${statusClass(status)}`}>{status}</span></div></div><small>{member.location_updated_at?relativeUpdated(member.location_updated_at,stale):"Standort geteilt"}</small>{stale&&<p>Dieser Standort wurde seit mehr als 30 Minuten nicht aktualisiert.</p>}<div className="member-popup-actions">{!own&&member.phone&&<a href={`tel:${member.phone}`}>Anrufen</a>}<a target="_blank" rel="noreferrer" href={navigationUrl(member.latitude!,member.longitude!)}>Navigieren</a></div></div></Popup></Marker>})}
  </MapContainer>;
}

function FitMap({points}:{points:[number,number][]}){const map=useMap();const key=useMemo(()=>JSON.stringify(points),[points]);useEffect(()=>{const timer=window.setTimeout(()=>{map.invalidateSize();if(!points.length)return;if(points.length===1)map.setView(points[0],15);else map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[70,70],paddingBottomRight:[70,130],maxZoom:15,animate:true})},150);return()=>window.clearTimeout(timer)},[map,key]);return null}

function memberIcon(member:Profile,own:boolean,stale:boolean){
  const status=member.participant_status||"kein Status";
  const cls=statusClass(status);
  const content=member.avatar_url?`<img src="${escapeHtml(member.avatar_url)}" alt=""/>`:`<span>${escapeHtml(initials(member.name))}</span>`;
  const alarm=cls==="status-help"?`<i class="v28-pin-alarm">!</i>`:"";
  return L.divIcon({
    className:`member-pin-v28 ${cls}${own?" is-own":""}${stale?" is-stale":""}`,
    html:`<div class="v28-pin-shell"><div class="v28-pin-avatar">${content}</div>${alarm}<b class="v28-pin-badge">${escapeHtml(status)}</b></div>`,
    iconSize:[112,86],iconAnchor:[56,70],popupAnchor:[0,-68]
  });
}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?"}
function statusClass(value:string){const n=value.toLowerCase();if(n.includes("hilfe"))return"status-help";if(n.includes("unterwegs"))return"status-travel";if(n.includes("hotel"))return"status-hotel";if(n.includes("später"))return"status-later";if(n.includes("pause"))return"status-pause";if(n.includes("bereit"))return"status-ready";return"status-none"}
function isStale(value?:string|null){if(!value)return true;return Date.now()-new Date(value).getTime()>STALE_AFTER_MS}
function relativeUpdated(value:string,stale:boolean){const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));const text=seconds<10?"gerade eben":seconds<60?`vor ${seconds} Sek.`:seconds<3600?`vor ${Math.floor(seconds/60)} Min.`:`vor ${Math.floor(seconds/3600)} Std.`;return `${stale?"Nicht aktuell · ":"Aktualisiert "}${text}`}
function escapeHtml(value:string){return value.replace(/[&<>'\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[char]||char))}
function navigationUrl(latitude:number,longitude:number,address?:string|null){const destination=address?.trim()||`${latitude},${longitude}`;return`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
function formatBerlin(value:string){return new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
