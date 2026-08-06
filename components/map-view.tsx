"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";
import { useApp } from "./app-provider";

const STALE_AFTER_MS=30*60*1000;
const POI_CACHE_TTL=6*60*60*1000;
const SEARCH_CACHE_TTL=24*60*60*1000;
const SEARCH_CACHE_VERSION="v2";
const POI_GRID=0.025;
const layerOptions=[["bar","Bars","🍺"],["nightclub","Clubs","🪩"],["restaurant","Restaurants","🍽️"],["hotel","Hotels","🏨"],["taxi","Taxi","🚕"],["atm","Geldautomaten","🏧"],["fuel","Tankstellen","⛽"],["toilets","Toiletten","🚻"],["hospital","Krankenhaus","🏥"],["police","Polizei","🚓"],["pharmacy","Apotheke","💊"]] as const;
type Poi={id:string;name:string;category:string;latitude:number;longitude:number;address?:string|null};
type SearchResult={latitude:number;longitude:number;name?:string;distanceKm?:number|null};
type Props={pins:MapPin[];programItems:ProgramItem[];members:Profile[];fitRequest:number};
type Selected=|{kind:"program";item:ProgramItem}|{kind:"pin";item:MapPin}|{kind:"poi";item:Poi}|{kind:"member";item:Profile;own:boolean;stale:boolean}|null;

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
  const [selectedTarget,setSelectedTarget]=useState<[number,number]|null>(null);
  const [mapCenter,setMapCenter]=useState<[number,number]>(center);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState("");
  const [mapMode,setMapMode]=useState<"standard"|"dark"|"satellite">("standard");
  const [selected,setSelected]=useState<Selected>(null);
  const lastMarkerTap=useRef(0);
  const orderedMembers=[...visibleMembers].sort((a,b)=>Number(statusClass(a.participant_status||"")==="status-help")-Number(statusClass(b.participant_status||"")==="status-help"));
  useEffect(()=>{localStorage.setItem("firestarter-map-layers",JSON.stringify(layers))},[layers]);
  useEffect(()=>{const close=()=>{setSelected(null);setSelectedTarget(null)};const key=(e:KeyboardEvent)=>{if(e.key==="Escape")close()};const visibility=()=>{if(document.visibilityState!=="visible")close()};window.addEventListener("pagehide",close);document.addEventListener("visibilitychange",visibility);document.addEventListener("keydown",key);return()=>{window.removeEventListener("pagehide",close);document.removeEventListener("visibilitychange",visibility);document.removeEventListener("keydown",key)}},[]);

  function choose(next:Exclude<Selected,null>,target:[number,number],event?:L.LeafletMouseEvent){
    lastMarkerTap.current=Date.now();
    if(event?.originalEvent){L.DomEvent.stopPropagation(event.originalEvent);event.originalEvent.preventDefault()}
    setMenuOpen(false);setSelected(next);setSelectedTarget(target);
  }
  function handleMapClick(){if(Date.now()-lastMarkerTap.current<350)return;setSelected(null);setSelectedTarget(null);setMenuOpen(false)}
  async function search(e:FormEvent){e.preventDefault();const term=query.trim();if(!term||searching)return;setSelected(null);setSelectedTarget(null);const localCenter=mapCenter;const cacheKey=searchCacheKey(term,localCenter[0],localCenter[1]);const cached=readSearchCache(cacheKey);setSearchError("");if(cached){setSearchTarget([cached.latitude,cached.longitude]);return}setSearching(true);try{const params=new URLSearchParams({q:term,lat:String(localCenter[0]),lon:String(localCenter[1])});const res=await fetch(`/api/map-search?${params.toString()}`);const data=await res.json();if(!res.ok||!Number.isFinite(data.latitude)||!Number.isFinite(data.longitude))throw new Error(data.error||"Kein Treffer gefunden.");const result:SearchResult={latitude:data.latitude,longitude:data.longitude,name:data.name,distanceKm:data.distanceKm};writeSearchCache(cacheKey,result);setSearchTarget([result.latitude,result.longitude])}catch(error){setSearchError(error instanceof Error?error.message:"Suche nicht verfügbar.")}finally{setSearching(false)}}
  const closeSelection=()=>{setSelected(null);setSelectedTarget(null)};

  return <div className="smart-map-wrap" style={{position:"relative"}}>
    <MapContainer center={center} zoom={14} className="map-container">
      <TileLayer attribution={mapMode==="satellite"?'Tiles © Esri':'&copy; OpenStreetMap'} url={tileUrl(mapMode)}/>
      <MapController points={points} fitRequest={fitRequest} layers={layers} setPois={setPois} searchTarget={searchTarget} selectedTarget={selectedTarget} onCenterChange={setMapCenter} onMapClick={handleMapClick}/>
      {programItems.filter(i=>i.latitude!=null&&i.longitude!=null).map(item=>{const markerType=item.marker_type??"program";return <Marker key={`program-${item.id}`} position={[item.latitude!,item.longitude!]} icon={eventMarker(markerType)} zIndexOffset={markerType==="meeting"?440:380} eventHandlers={{click:e=>choose({kind:"program",item},[item.latitude!,item.longitude!],e)}}/>})}
      {pins.map(pin=><Marker key={`pin-${pin.id}`} position={[pin.latitude,pin.longitude]} icon={eventMarker("meeting")} zIndexOffset={450} eventHandlers={{click:e=>choose({kind:"pin",item:pin},[pin.latitude,pin.longitude],e)}}/>)}
      {pois.map(poi=><Marker key={`poi-${poi.id}`} position={[poi.latitude,poi.longitude]} icon={poiIcon(poi.category)} zIndexOffset={120} eventHandlers={{click:e=>choose({kind:"poi",item:poi},[poi.latitude,poi.longitude],e)}}/>)}
      {orderedMembers.map(member=>{const own=member.id===profile?.id;const stale=isStale(member.location_updated_at);const status=member.participant_status||"kein Status";const help=statusClass(status)==="status-help";return <Marker key={`member-${member.id}`} position={[member.latitude!,member.longitude!]} icon={memberIcon(member,own,stale)} zIndexOffset={help?1000:own?700:500} eventHandlers={{click:e=>choose({kind:"member",item:member,own,stale},[member.latitude!,member.longitude!],e)}}/>})}
    </MapContainer>
    <form className="map-search-box" onSubmit={search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="In deiner Nähe suchen, z. B. EDEKA …"/><button disabled={searching}>{searching?"Suche …":"Suchen"}</button>{searchError&&<small className="map-search-error">{searchError}</small>}</form>
    <button type="button" className="map-layer-button" onClick={()=>{closeSelection();setMenuOpen(v=>!v)}}>Ebenen</button>
    {menuOpen&&<div className="map-layer-menu"><strong>Kartenebenen</strong>{layerOptions.map(([key,label,emoji])=><label key={key}><input type="checkbox" checked={layers.includes(key)} onChange={()=>setLayers(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key])}/><span>{emoji} {label}</span></label>)}<div className="map-mode-row"><button type="button" className={mapMode==="standard"?"active":""} onClick={()=>setMapMode("standard")}>Standard</button><button type="button" className={mapMode==="dark"?"active":""} onClick={()=>setMapMode("dark")}>Dark</button><button type="button" className={mapMode==="satellite"?"active":""} onClick={()=>setMapMode("satellite")}>Satellit</button></div></div>}
    {selected&&<MapDetailSheet selected={selected} onClose={closeSelection}/>} 
  </div>;
}

function MapDetailSheet({selected,onClose}:{selected:Exclude<Selected,null>;onClose:()=>void}){let content:React.ReactNode;let nav="";if(selected.kind==="program"){const i=selected.item,m=i.marker_type??"program";nav=navigationUrl(i.latitude!,i.longitude!,i.address);content=<><span className={`event-popup-kind ${m}`}>{m==="meeting"?"Treffpunkt":"Programmpunkt"}</span><strong>{i.title}</strong>{i.starts_at&&<small>{formatBerlin(i.starts_at)}</small>}{i.description&&<p>{i.description}</p>}{i.address&&<span>{i.address}</span>}</>}else if(selected.kind==="pin"){const i=selected.item;nav=navigationUrl(i.latitude,i.longitude,i.address);content=<><span className="event-popup-kind meeting">Treffpunkt</span><strong>{i.title}</strong>{i.description&&<p>{i.description}</p>}{i.address&&<span>{i.address}</span>}</>}else if(selected.kind==="poi"){const i=selected.item;nav=navigationUrl(i.latitude,i.longitude,i.address);content=<><span>{categoryEmoji(i.category)} {categoryLabel(i.category)}</span><strong>{i.name}</strong>{i.address&&<small>{i.address}</small>}</>}else{const m=selected.item,s=m.participant_status||"kein Status";nav=navigationUrl(m.latitude!,m.longitude!);content=<><div className="member-popup-head"><span className="member-popup-avatar">{m.avatar_url?<img src={m.avatar_url} alt=""/>:<b>{initials(m.name)}</b>}</span><div><strong>{selected.own?"Mein Standort":m.name}</strong><span className={`map-status-badge ${statusClass(s)}`}>{statusDisplay(s)}</span></div></div><small>{m.location_updated_at?relativeUpdated(m.location_updated_at,selected.stale):"Standort geteilt"}</small>{selected.stale&&<p>Dieser Standort wurde seit mehr als 30 Minuten nicht aktualisiert.</p>}{!selected.own&&m.phone&&<a href={`tel:${m.phone}`}>Anrufen</a>}</>}return <section aria-label="Kartendetails" style={{position:"absolute",left:10,right:10,bottom:10,zIndex:900,maxHeight:"45%",overflowY:"auto",padding:"18px",borderRadius:"22px",background:"rgba(12,12,12,.97)",boxShadow:"0 12px 40px rgba(0,0,0,.55)",border:"1px solid rgba(255,255,255,.12)",pointerEvents:"auto",touchAction:"pan-y"}}><button type="button" aria-label="Details schließen" onClick={onClose} style={{position:"absolute",right:10,top:10,width:38,height:38,borderRadius:"50%",border:"1px solid rgba(255,255,255,.16)",background:"#202020",color:"white",fontSize:24,lineHeight:1}}>×</button><div className="map-popup" style={{paddingRight:38}}>{content}<a target="_blank" rel="noreferrer" href={nav} onClick={onClose}>Dorthin navigieren</a></div></section>}

function MapController({points,fitRequest,layers,setPois,searchTarget,selectedTarget,onCenterChange,onMapClick}:{points:[number,number][];fitRequest:number;layers:string[];setPois:(v:Poi[])=>void;searchTarget:[number,number]|null;selectedTarget:[number,number]|null;onCenterChange:(v:[number,number])=>void;onMapClick:()=>void}){
  const map=useMap();
  const initialized=useRef(false);
  const lastFit=useRef(fitRequest);
  const loadTimer=useRef<number|null>(null);
  const abortRef=useRef<AbortController|null>(null);
  const lastLoad=useRef<{lat:number;lon:number;zoom:number;layers:string}|undefined>(undefined);
  const returnView=useRef<{center:L.LatLng;zoom:number}|null>(null);
  const wasSelected=useRef(false);
  useEffect(()=>{const t=window.setTimeout(()=>{map.invalidateSize();const c=map.getCenter();onCenterChange([c.lat,c.lng]);if(initialized.current||!points.length)return;fitAll(map,points);initialized.current=true},150);return()=>window.clearTimeout(t)},[map,points,onCenterChange]);
  useEffect(()=>{if(lastFit.current===fitRequest)return;lastFit.current=fitRequest;returnView.current=null;wasSelected.current=false;fitAll(map,points)},[fitRequest,map,points]);
  useEffect(()=>{
    if(selectedTarget){
      if(!wasSelected.current)returnView.current={center:map.getCenter(),zoom:map.getZoom()};
      wasSelected.current=true;
      const zoom=Math.max(map.getZoom(),15);
      const markerPoint=map.project(L.latLng(selectedTarget),zoom);
      const centered=map.unproject(markerPoint.add([0,115]),zoom);
      map.flyTo(centered,zoom,{duration:.35,easeLinearity:.35});
      return;
    }
    if(wasSelected.current&&returnView.current){
      const previous=returnView.current;
      map.flyTo(previous.center,previous.zoom,{duration:.4,easeLinearity:.35});
    }
    wasSelected.current=false;returnView.current=null;
  },[map,selectedTarget]);
  const requestPois=async(lat:number,lon:number,force=false)=>{if(!layers.length){setPois([]);return}if(map.getZoom()<13)return;const layerKey=[...layers].sort().join(","),zoom=map.getZoom();if(!force&&lastLoad.current&&lastLoad.current.layers===layerKey&&Math.abs(lastLoad.current.zoom-zoom)<1&&haversineKm(lastLoad.current.lat,lastLoad.current.lon,lat,lon)<.75)return;lastLoad.current={lat,lon,zoom,layers:layerKey};const key=poiCacheKey(lat,lon,layerKey,zoom),cached=readPoiCache(key);if(cached){setPois(cached);return}abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;try{const radius=zoom>=16?2600:zoom>=14?4000:5000;const res=await fetch(`/api/pois?lat=${lat}&lon=${lon}&radius=${radius}&categories=${layerKey}`,{signal:controller.signal});const data=await res.json();if(res.ok){const fresh=(data.pois??[]) as Poi[];writePoiCache(key,fresh);setPois(fresh)}}catch(error){if((error as Error).name!=="AbortError"&&cached)setPois(cached)}};
  useEffect(()=>{if(!searchTarget)return;returnView.current=null;wasSelected.current=false;requestPois(searchTarget[0],searchTarget[1],true);map.flyTo(searchTarget,16,{duration:.8})},[map,searchTarget]);
  const scheduleLoad=()=>{const c=map.getCenter();onCenterChange([c.lat,c.lng]);if(loadTimer.current)window.clearTimeout(loadTimer.current);loadTimer.current=window.setTimeout(()=>requestPois(c.lat,c.lng),220)};useMapEvents({click:onMapClick,moveend:scheduleLoad,zoomend:scheduleLoad});useEffect(()=>{const c=map.getCenter();onCenterChange([c.lat,c.lng]);requestPois(c.lat,c.lng,true);return()=>{if(loadTimer.current)window.clearTimeout(loadTimer.current);abortRef.current?.abort()}},[layers]);return null
}

function poiCacheKey(lat:number,lon:number,layers:string,zoom:number){return`${Math.round(lat/POI_GRID)}:${Math.round(lon/POI_GRID)}:${zoom>=16?16:14}:${layers}`}
function readPoiCache(key:string){try{const raw=localStorage.getItem(`firestarter-pois:${key}`);if(!raw)return null;const parsed=JSON.parse(raw) as {time:number;pois:Poi[]};if(Date.now()-parsed.time>POI_CACHE_TTL){localStorage.removeItem(`firestarter-pois:${key}`);return null}return parsed.pois}catch{return null}}
function writePoiCache(key:string,pois:Poi[]){try{localStorage.setItem(`firestarter-pois:${key}`,JSON.stringify({time:Date.now(),pois}));localStorage.setItem("firestarter-pois-recent",JSON.stringify({time:Date.now(),pois}))}catch{}}
function readRecentPois(){try{const raw=localStorage.getItem("firestarter-pois-recent");if(!raw)return[];const parsed=JSON.parse(raw) as {time:number;pois:Poi[]};return Date.now()-parsed.time<POI_CACHE_TTL?parsed.pois:[]}catch{return[]}}
function searchCacheKey(term:string,lat:number,lon:number){return`${SEARCH_CACHE_VERSION}:${term.toLowerCase()}:${lat.toFixed(3)}:${lon.toFixed(3)}`}
function readSearchCache(key:string){try{const raw=localStorage.getItem(`firestarter-search:${key}`);if(!raw)return null;const parsed=JSON.parse(raw) as {time:number;result:SearchResult};if(Date.now()-parsed.time>SEARCH_CACHE_TTL){localStorage.removeItem(`firestarter-search:${key}`);return null}return parsed.result}catch{return null}}
function writeSearchCache(key:string,result:SearchResult){try{localStorage.setItem(`firestarter-search:${key}`,JSON.stringify({time:Date.now(),result}))}catch{}}
function fitAll(map:L.Map,points:[number,number][]){if(!points.length)return;if(points.length===1)map.setView(points[0],15);else map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[80,80],paddingBottomRight:[80,150],maxZoom:15,animate:true})}
function eventMarker(type:"program"|"meeting"){return type==="meeting"?L.divIcon({className:"event-pin-v29 meeting",html:'<div class="event-pin-shell"><span class="meeting-flame">🔥</span><b>Treffpunkt</b></div>',iconSize:[118,106],iconAnchor:[59,92]}):L.divIcon({className:"event-pin-v29 program",html:'<div class="event-pin-shell"><span class="program-star">★</span><b>Programmpunkt</b></div>',iconSize:[130,102],iconAnchor:[65,88]})}
function poiIcon(category:string){return L.divIcon({className:"smart-poi-marker",html:`<span>${categoryEmoji(category)}</span>`,iconSize:[38,38],iconAnchor:[19,19]})}
function memberIcon(member:Profile,own:boolean,stale:boolean){const status=member.participant_status||"kein Status",cls=statusClass(status),content=member.avatar_url?`<img src="${escapeHtml(member.avatar_url)}" alt=""/>`:`<span>${escapeHtml(initials(member.name))}</span>`,alarm=cls==="status-help"?'<i class="v28-pin-alarm">!</i>':"";return L.divIcon({className:`member-pin-v28 ${cls}${own?" is-own":""}${stale?" is-stale":""}`,html:`<div class="v28-pin-shell"><div class="v28-pin-avatar">${content}</div>${alarm}<b class="v28-pin-badge">${escapeHtml(statusDisplay(status))}</b></div>`,iconSize:[126,86],iconAnchor:[63,70]})}
function readLayers(){try{return JSON.parse(localStorage.getItem("firestarter-map-layers")||"[]") as string[]}catch{return[]}}
function tileUrl(mode:string){if(mode==="dark")return"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";if(mode==="satellite")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";return"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
function categoryEmoji(c:string){return layerOptions.find(x=>x[0]===c)?.[2]||"📍"}function categoryLabel(c:string){return layerOptions.find(x=>x[0]===c)?.[1]||"POI"}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join("")||"?"}
function statusClass(value:string){const n=value.toLowerCase();if(n.includes("hilfe"))return"status-help";if(n.includes("schlaf")||n.includes("hotel"))return"status-sleeping";if(n.includes("tanz"))return"status-dancing";if(n.includes("breit"))return"status-wasted";if(n.includes("sauf")||n.includes("trink"))return"status-drinking";if(n.includes("freud")||n.includes("bereit"))return"status-happy";if(n.includes("unterwegs"))return"status-travel";if(n.includes("pause"))return"status-pause";return"status-none"}
function statusDisplay(value:string){const n=value.toLowerCase();if(n.includes("hilfe"))return"🆘 Brauche Hilfe!";if(n.includes("schlaf")||n.includes("hotel"))return"😴 Beim Schlafen";if(n.includes("tanz"))return"🕺 Beim Tanzen";if(n.includes("breit"))return"🥴 Total breit";if(n.includes("sauf")||n.includes("trink"))return"🍻 Beim Saufen";if(n.includes("freud")||n.includes("bereit"))return"😄 Freudig";if(n.includes("unterwegs"))return"🚶 Unterwegs";if(n.includes("pause"))return"☕ Brauche Pause";return value||"Kein Status"}
function isStale(value?:string|null){return !value||Date.now()-new Date(value).getTime()>STALE_AFTER_MS}
function relativeUpdated(value:string,stale:boolean){const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));const text=seconds<10?"gerade eben":seconds<60?`vor ${seconds} Sek.`:seconds<3600?`vor ${Math.floor(seconds/60)} Min.`:`vor ${Math.floor(seconds/3600)} Std.`;return`${stale?"Nicht aktuell · ":"Aktualisiert "}${text}`}
function escapeHtml(value:string){return value.replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]||c))}
function navigationUrl(latitude:number,longitude:number,address?:string|null){return`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address?.trim()||`${latitude},${longitude}`)}`}
function formatBerlin(value:string){return new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){const r=6371,toRad=(v:number)=>v*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}