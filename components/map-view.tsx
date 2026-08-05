"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const STALE_AFTER_MS=30*60*1000;
const POI_CACHE_TTL=6*60*60*1000;
const SEARCH_CACHE_TTL=24*60*60*1000;
const POI_GRID=0.025;
const layerOptions=[
  ["bar","Bars","🍺"],["nightclub","Clubs","🪩"],["restaurant","Restaurants","🍽️"],["hotel","Hotels","🏨"],
  ["taxi","Taxi","🚕"],["atm","Geldautomaten","🏧"],["fuel","Tankstellen","⛽"],["toilets","Toiletten","🚻"],
  ["hospital","Krankenhaus","🏥"],["police","Polizei","🚓"],["pharmacy","Apotheke","💊"]
] as const;
type Poi={id:string;name:string;category:string;latitude:number;longitude:number;address?:string|null};
type SearchResult={latitude:number;longitude:number;name?:string;distanceKm?:number|null};
type Props={pins:MapPin[];programItems:ProgramItem[];members:Profile[];fitRequest:number};

export function MapView({pins,programItems,members,fitRequest}:Props){
  const {profile}=useApp();
  const visibleMembers=members.filter(m=>m.share_location&&m.latitude!=null&&m.longitude!=null);
  const points:[number,number][]= [...pins.map(p=>[p.latitude,p.longitude] as [number,number]),...programItems.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>[p.latitude!,p.longitude!] as [number,number]),...visibleMembers.map(m=>[m.latitude!,m.longitude!] as [number,number])];
  const center:[number,number]=profile?.latitude!=null&&profile?.longitude!=null?[profile.latitude,profile.longitude]:points[0]??[48.6778281,9.21833];
  const [layers,setLayers]=useState<string[]>(()=>readLayers());
  const [pois,setPois]=useState<Poi[]>(()=>readRecentPois());
  const [menuOpen,setMenuOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [searchTarget,setSearchTarget]=useState<[number,number]|null>(null);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState("");
  const [mapMode,setMapMode]=useState<"standard"|"dark"|"satellite">("standard");
  const orderedMembers=[...visibleMembers].sort((a,b)=>Number(statusClass(a.participant_status||"")==="status-help")-Number(statusClass(b.participant_status||"")==="status-help"));

  useEffect(()=>{localStorage.setItem("firestarter-map-layers",JSON.stringify(layers))},[layers]);

  async function search(e:FormEvent){
    e.preventDefault();const term=query.trim();if(!term||searching)return;
    const localCenter=profile?.latitude!=null&&profile?.longitude!=null?[profile.latitude,profile.longitude] as [number,number]:center;
    const cacheKey=searchCacheKey(term,localCenter[0],localCenter[1]);
    const cached=readSearchCache(cacheKey);
    setSearchError("");
    if(cached){setSearchTarget([cached.latitude,cached.longitude]);return}
    setSearching(true);
    try{
      const params=new URLSearchParams({q:term,lat:String(localCenter[0]),lon:String(localCenter[1])});
      const res=await fetch(`/api/map-search?${params.toString()}`);
      const data=await res.json();
      if(!res.ok||!Number.isFinite(data.latitude)||!Number.isFinite(data.longitude))throw new Error(data.error||"Kein Treffer gefunden.");
      const result:SearchResult={latitude:data.latitude,longitude:data.longitude,name:data.name,distanceKm:data.distanceKm};
      writeSearchCache(cacheKey,result);
      setSearchTarget([result.latitude,result.longitude]);
    }catch(error){setSearchError(error instanceof Error?error.message:"Suche nicht verfügbar.")}
    finally{setSearching(false)}
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
    <form className="map-search-box" onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="In deiner Nähe suchen, z. B. EDEKA …"/><button disabled={searching}>{searching?"Suche …":"Suchen"}</button>{searchError&&<small className="map-search-error">{searchError}</small>}</form>
    <button className="map-layer-button" onClick={()=>setMenuOpen(v=>!v)}>Ebenen</button>
    {menuOpen&&<div className="map-layer-menu"><strong>Kartenebenen</strong>{layerOptions.map(([key,label,emoji])=><label key={key}><input type="checkbox" checked={layers.includes(key)} onChange={()=>setLayers(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}/><span>{emoji} {label}</span></label>)}<div className="map-mode-row"><button className={mapMode==="standard"?"active":""} onClick={()=>setMapMode("standard")}>Standard</button><button className={mapMode==="dark"?"active":""} onClick={()=>setMapMode("dark")}>Dark</button><button className={mapMode==="satellite"?"active":""} onClick={()=>setMapMode("satellite")}>Satellit</button></div></div>}
  </div>;
}

function MapController({points,fitRequest,layers,setPois,searchTarget}:{points:[number,number][];fitRequest:number;layers:string[];setPois:(v:Poi[])=>void;searchTarget:[number,number]|null}){
  const map=useMap();const initialized=useRef(false);const lastFit=useRef(fitRequest);const loadTimer=useRef<number|null>(null);const abortRef=useRef<AbortController|null>(null);const lastLoad=useRef<{lat:number;lon:number;zoom:number;layers:string}>();
  useEffect(()=>{const timer=window.setTimeout(()=>{map.invalidateSize();if(initialized.current||!points.length)return;fitAll(map,points);initialized.current=true},150);return()=>window.clearTimeout(timer)},[map,points]);
  useEffect(()=>{if(lastFit.current===fitRequest)return;lastFit.current=fitRequest;fitAll(map,points)},[fitRequest,map,points]);

  const requestPois=async(lat:number,lon:number,force=false)=>{
    if(!layers.length||map.getZoom()<13){setPois([]);return}
    const layerKey=[...layers].sort().join(",");const zoom=map.getZoom();
    if(!force&&lastLoad.current&&lastLoad.current.layers===layerKey&&Math.abs(lastLoad.current.zoom-zoom)<1&&haversineKm(lastLoad.current.lat,lastLoad.current.lon,lat,lon)<0.75)return;
    lastLoad.current={lat,lon,zoom,layers:layerKey};
    const key=poiCacheKey(lat,lon,layerKey,zoom);
    const cached=readPoiCache(key);
    if(cached){setPois(cached);return}
    abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;
    try{
      const radius=zoom>=16?2600:zoom>=14?4000:5000;
      const res=await fetch(`/api/pois?lat=${lat}&lon=${lon}&radius=${radius}&categories=${layerKey}`,{signal:controller.signal});
      const data=await res.json();if(res.ok){const fresh=(data.pois??[]) as Poi[];writePoiCache(key,fresh);setPois(fresh)}
    }catch(error){if((error as Error).name!=="AbortError"&&cached)setPois(cached)}
  };

  useEffect(()=>{if(!searchTarget)return;requestPois(searchTarget[0],searchTarget[1],true);map.flyTo(searchTarget,16,{duration:.8})},[map,searchTarget]);
  const scheduleLoad=()=>{if(loadTimer.current)window.clearTimeout(loadTimer.current);loadTimer.current=window.setTimeout(()=>{const c=map.getCenter();requestPois(c.lat,c.lng)},220)};
  useMapEvents({moveend:scheduleLoad,zoomend:scheduleLoad});
  useEffect(()=>{const c=map.getCenter();requestPois(c.lat,c.lng,true);return()=>{if(loadTimer.current)window.clearTimeout(loadTimer.current);abortRef.current?.abort()}},[layers]);
  return null;
}

function poiCacheKey(lat:number,lon:number,layers:string,zoom:number){return`${Math.round(lat/POI_GRID)}:${Math.round(lon/POI_GRID)}:${zoom>=16?16:14}:${layers}`}
function readPoiCache(key:string){try{const raw=localStorage.getItem(`firestarter-pois:${key}`);if(!raw)return null;const parsed=JSON.parse(raw) as {time:number;pois:Poi[]};if(Date.now()-parsed.time>POI_CACHE_TTL){localStorage.removeItem(`firestarter-pois:${key}`);return null}return parsed.pois}catch{return null}}
function writePoiCache(key:string,pois:Poi[]){try{localStorage.setItem(`firestarter-pois:${key}`,JSON.stringify({time:Date.now(),pois}));localStorage.setItem("firestarter-pois-recent",JSON.stringify({time:Date.now(),pois}))}catch{}}
function readRecentPois(){try{const raw=localStorage.getItem("firestarter-pois-recent");if(!raw)return[];const parsed=JSON.parse(raw) as {time:number;pois:Poi[]};return Date.now()-parsed.time<POI_CACHE_TTL?parsed.pois:[]}catch{return[]}}
function searchCacheKey(term:string,lat:number,lon:number){return`${term.toLowerCase()}:${lat.toFixed(2)}:${lon.toFixed(2)}`}
function readSearchCache(key:string){try{const raw=localStorage.getItem(`firestarter-search:${key}`);if(!raw)return null;const parsed=JSON.parse(raw) as {time:number;result:SearchResult};if(Date.now()-parsed.time>SEARCH_CACHE_TTL){localStorage.removeItem(`firestarter-search:${key}`);return null}return parsed.result}catch{return null}}
function writeSearchCache(key:string,result:SearchResult){try{localStorage.setItem(`firestarter-search:${key}`,JSON.stringify({time:Date.now(),result}))}catch{}}
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
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){const r=6371;const toRad=(v:number)=>v*Math.PI/180;const dLat=toRad(lat2-lat1);const dLon=toRad(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
