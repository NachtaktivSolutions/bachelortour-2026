"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const STALE_AFTER_MS=30*60*1000;
const layerOptions=[
  ["bar","Bars","🍺"],["nightclub","Clubs","🪩"],["restaurant","Restaurants","🍽️"],["hotel","Hotels","🏨"],
  ["taxi","Taxi","🚕"],["atm","Geldautomaten","🏧"],["fuel","Tankstellen","⛽"],["toilets","Toiletten","🚻"],
  ["hospital","Krankenhaus","🏥"],["police","Polizei","🚓"],["pharmacy","Apotheke","💊"]
] as const;
type Poi={id:string;name:string;category:string;latitude:number;longitude:number;address?:string|null};
type Props={pins:MapPin[];programItems:ProgramItem[];members:Profile[];fitRequest:number};

export function MapView({pins,programItems,members,fitRequest}:Props){
  const {profile}=useApp();
  const visibleMembers=members.filter(m=>m.share_location&&m.latitude!=null&&m.longitude!=null);
  const points:[number,number][]= [...pins.map(p=>[p.latitude,p.longitude] as [number,number]),...programItems.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>[p.latitude!,p.longitude!] as [number,number]),...visibleMembers.map(m=>[m.latitude!,m.longitude!] as [number,number])];
  const center:[number,number]=profile?.latitude!=null&&profile?.longitude!=null?[profile.latitude,profile.longitude]:points[0]??[48.6778281,9.21833];
  const [layers,setLayers]=useState<string[]>(()=>readLayers());
  const [pois,setPois]=useState<Poi[]>([]);
  const [menuOpen,setMenuOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [searchTarget,setSearchTarget]=useState<[number,number]|null>(null);
  const [mapMode,setMapMode]=useState<"standard"|"dark"|"satellite">("standard");
  const orderedMembers=[...visibleMembers].sort((a,b)=>Number(statusClass(a.participant_status||"")==="status-help")-Number(statusClass(b.participant_status||"")==="status-help"));

  useEffect(()=>{localStorage.setItem("firestarter-map-layers",JSON.stringify(layers))},[layers]);

  async function search(e:FormEvent){
    e.preventDefault();if(!query.trim())return;
    const localCenter=profile?.latitude!=null&&profile?.longitude!=null?[profile.latitude,profile.longitude] as [number,number]:center;
    const params=new URLSearchParams({q:query.trim(),lat:String(localCenter[0]),lon:String(localCenter[1])});
    const res=await fetch(`/api/map-search?${params.toString()}`);
    const data=await res.json();if(res.ok&&data.latitude)setSearchTarget([data.latitude,data.longitude]);
  }

  return <div className="smart-map-wrap">
    <MapContainer center={center} zoom={14} className="map-container">
      <TileLayer attribution={mapMode==="satellite"?'Tiles © Esri':'&copy; OpenStreetMap'} url={tileUrl(mapMode)}/>
      <MapController points={points} fitRequest={fitRequest} layers={layers} setPois={setPois} searchTarget={searchTarget}/>
      {programItems.filter(item=>item.latitude!=null&&item.longitude!=null).map(item=>{const markerType=item.marker_type??"program";return <Marker key={`program-${item.id}`} position={[item.latitude!,item.longitude!]} icon={eventMarker(markerType)} zIndexOffset={markerType==="meeting"?440:380}><Popup><div className="map-popup event-map-popup"><span className={`event-popup-kind ${markerType}`}>{markerType==="meeting"?"Treffpunkt":"Programmpunkt"}</span><strong>{item.title}</strong>{item.starts_at&&<small>{formatBerlin(item.starts_at)}</small>}{item.description&&<p>{item.description}</p>}{item.address&&<span>{item.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(item.latitude!,item.longitude!,item.address)}>Dorthin navigieren</a></div></Popup></Marker>})}
      {pins.map(pin=><Marker key={`pin-${pin.id}`} position={[pin.latitude,pin.longitude]} icon={eventMarker("meeting")} zIndexOffset={450}><Popup><div className="map-popup event-map-popup"><span className="event-popup-kind meeting">Treffpunkt</span><strong>{pin.title}</strong>{pin.description&&<p>{pin.description}</p>}{pin.address&&<span>{pin.address}</span>}<a target="_blank" rel="noreferrer" href={navigationUrl(pin.latitude,pin.longitude,pin.address)}>Dorthin navigieren</a></div></Popup></Marker>)}
      {pois.map(poi=><Marker key={`poi-${poi.id}`} position={[poi.latitude,poi.longitude]} icon={poiIcon(poi.category)} zIndexOffset={120}><Popup><div className="map-popup poi-popup"><span>{categoryEmoji(poi.category)} {categoryLabel(poi.category)}</span><strong>{poi.name}</strong>{poi.address&&<small>{poi.address}</small>}<a target="_blank" rel="noreferrer" href={navigationUrl(poi.latitude,poi.longitude)}>Navigieren</a></div></Popup></Marker>)}
      {orderedMembers.map(member=>{const own=member.id===profile?.id;const stale=isStale(member.location_updated_at);const status=member.participant_status||"kein Status";const help=statusClass(status)==="status-help";return <Marker key={`member-${member.id}`} position={[member.latitude!,member.longitude!]} icon={memberIcon(member,own,stale)} zIndexOffset={help?1000:own?700:500}><Popup><div className="map-popup member-map-popup"><div className="member-popup-head"><span className="member-popup-avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<b>{initials(member.name)}</b>}</span><div><strong>{own?"Mein Standort":member.name}</strong><span className={`map-status-badge ${statusClass(status)}`}>{status}</span></div></div><small>{member.location_updated_at?relativeUpdated(member.location_updated_at,stale):"Standort geteilt"}</small>{stale&&<p>Dieser Standort wurde seit mehr als 30 Minuten nicht aktualisiert.</p>}<div className="member-popup-actions">{!own&&member.phone&&<a href={`tel:${member.phone}`}>Anrufen</a>}<a target="_blank" rel="noreferrer" href={navigationUrl(member.latitude!,member.longitude!)}>Navigieren</a></div></div></Popup></Marker>})}
    </MapContainer>
    <form className="map-search-box" onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="In deiner Nähe suchen, z. B. REWE …"/><button>Suchen</button></form>
    <button className="map-layer-button" onClick={()=>setMenuOpen(v=>!v)}>Ebenen</button>
    {menuOpen&&<div className="map-layer-menu"><strong>Kartenebenen</strong>{layerOptions.map(([key,label,emoji])=><label key={key}><input type="checkbox" checked={layers.includes(key)} onChange={()=>setLayers(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}/><span>{emoji} {label}</span></label>)}<div className="map-mode-row"><button className={mapMode==="standard"?"active":""} onClick={()=>setMapMode("standard")}>Standard</button><button className={mapMode==="dark"?"active":""} onClick={()=>setMapMode("dark")}>Dark</button><button className={mapMode==="satellite"?"active":""} onClick={()=>setMapMode("satellite")}>Satellit</button></div></div>}
  </div>;
}

function MapController({points,fitRequest,layers,setPois,searchTarget}:{points:[number,number][];fitRequest:number;layers:string[];setPois:(v:Poi[])=>void;searchTarget:[number,number]|null}){
  const map=useMap();const initialized=useRef(false);const lastFit=useRef(fitRequest);const loadTimer=useRef<number|null>(null);
  useEffect(()=>{const timer=window.setTimeout(()=>{map.invalidateSize();if(initialized.current||!points.length)return;fitAll(map,points);initialized.current=true},150);return()=>window.clearTimeout(timer)},[map,points]);
  useEffect(()=>{if(lastFit.current===fitRequest)return;lastFit.current=fitRequest;fitAll(map,points)},[fitRequest,map,points]);
  useEffect(()=>{if(searchTarget)map.flyTo(searchTarget,16,{duration:.8})},[map,searchTarget]);
  const loadPois=async()=>{if(loadTimer.current)window.clearTimeout(loadTimer.current);loadTimer.current=window.setTimeout(async()=>{if(!layers.length||map.getZoom()<13){setPois([]);return}const c=map.getCenter();const res=await fetch(`/api/pois?lat=${c.lat}&lon=${c.lng}&radius=${map.getZoom()>=16?1800:3000}&categories=${layers.join(",")}`);const data=await res.json();if(res.ok)setPois(data.pois??[])},350)};
  useMapEvents({moveend:loadPois,zoomend:loadPois});
  useEffect(()=>{loadPois();return()=>{if(loadTimer.current)window.clearTimeout(loadTimer.current)}},[layers]);
  return null;
}

function fitAll(map:L.Map,points:[number,number][]){if(!points.length)return;if(points.length===1)map.setView(points[0],15);else map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[80,80],paddingBottomRight:[80,150],maxZoom:15,animate:true})}
function eventMarker(type:"program"|"meeting"){if(type==="meeting")return L.divIcon({className:"event-pin-v29 meeting",html:'<div class="event-pin-shell"><span class="meeting-flame">🔥</span><b>Treffpunkt</b></div>',iconSize:[118,106],iconAnchor:[59,92],popupAnchor:[0,-85]});return L.divIcon({className:"event-pin-v29 program",html:'<div class="event-pin-shell"><span class="program-star">★</span><b>Programmpunkt</b></div>',iconSize:[130,102],iconAnchor:[65,88],popupAnchor:[0,-82]})}
function poiIcon(category:string){return L.divIcon({className:"smart-poi-marker",html:`<span>${categoryEmoji(category)}</span>`,iconSize:[38,38],iconAnchor:[19,19],popupAnchor:[0,-18]})}
function memberIcon(member:Profile,own:boolean,stale:boolean){const status=member.participant_status||"kein Status";const cls=statusClass(status);const content=member.avatar_url?`<img src="${escapeHtml(member.avatar_url)}" alt=""/>`:`<span>${escapeHtml(initials(member.name))}</span>`;const alarm=cls==="status-help"?`<i class="v28-pin-alarm">!</i>`:"";return L.divIcon({className:`member-pin-v28 ${cls}${own?" is-own":""}${stale?" is-stale":""}`,html:`<div class="v28-pin-shell"><div class="v28-pin-avatar">${content}</div>${alarm}<b class="v28-pin-badge">${escapeHtml(status)}</b></div>`,iconSize:[112,86],iconAnchor:[56,70],popupAnchor:[0,-68]})}
function readLayers(){try{return JSON.parse(localStorage.getItem("firestarter-map-layers")||"[]") as string[]}catch{return[]}}
function tileUrl(mode:string){if(mode==="dark")return"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";if(mode==="satellite")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";return"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
function categoryEmoji(c:string){return layerOptions.find(x=>x[0]===c)?.[2]||"📍"}function categoryLabel(c:string){return layerOptions.find(x=>x[0]===c)?.[1]||"POI"}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?"}
function statusClass(value:string){const n=value.toLowerCase();if(n.includes("hilfe"))return"status-help";if(n.includes("unterwegs"))return"status-travel";if(n.includes("hotel"))return"status-hotel";if(n.includes("später"))return"status-later";if(n.includes("pause"))return"status-pause";if(n.includes("bereit"))return"status-ready";return"status-none"}
function isStale(value?:string|null){if(!value)return true;return Date.now()-new Date(value).getTime()>STALE_AFTER_MS}
function relativeUpdated(value:string,stale:boolean){const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));const text=seconds<10?"gerade eben":seconds<60?`vor ${seconds} Sek.`:seconds<3600?`vor ${Math.floor(seconds/60)} Min.`:`vor ${Math.floor(seconds/3600)} Std.`;return `${stale?"Nicht aktuell · ":"Aktualisiert "}${text}`}
function escapeHtml(value:string){return value.replace(/[&<>'\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[char]||char))}
function navigationUrl(latitude:number,longitude:number,address?:string|null){const destination=address?.trim()||`${latitude},${longitude}`;return`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
function formatBerlin(value:string){return new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
