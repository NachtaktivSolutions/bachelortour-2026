import { NextRequest, NextResponse } from "next/server";

type NominatimResult={lat:string;lon:string;display_name:string;importance?:number};
type OverpassElement={id:number;type:string;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>};

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get("q")?.trim();
  const lat=Number(req.nextUrl.searchParams.get("lat"));
  const lon=Number(req.nextUrl.searchParams.get("lon"));
  const hasCenter=Number.isFinite(lat)&&Number.isFinite(lon);
  if(!q)return NextResponse.json({error:"Suchbegriff fehlt."},{status:400});

  try{
    // Für Geschäfte und POIs zuerst direkt in OpenStreetMap im Umkreis suchen.
    // Nominatim liefert bei Kettennamen wie EDEKA/REWE oft nur einige ausgewählte Filialen
    // und lässt die tatsächlich nächstgelegene Filiale aus.
    if(hasCenter){
      const nearby=await searchNearbyPoi(q,lat,lon);
      if(nearby.length){
        const nearest=nearby[0];
        return NextResponse.json({
          latitude:nearest.latitude,
          longitude:nearest.longitude,
          name:nearest.name,
          distanceKm:nearest.distanceKm,
          results:nearby.slice(0,8)
        });
      }
    }

    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q",q);
    url.searchParams.set("format","jsonv2");
    url.searchParams.set("limit","20");
    url.searchParams.set("countrycodes","de");
    url.searchParams.set("addressdetails","1");

    if(hasCenter){
      const latDelta=0.18;
      const lonDelta=0.28;
      url.searchParams.set("viewbox",`${lon-lonDelta},${lat+latDelta},${lon+lonDelta},${lat-latDelta}`);
      url.searchParams.set("bounded","0");
    }

    const response=await fetch(url,{headers:{"User-Agent":"Firestarter-2026-PWA"},cache:"no-store"});
    const data=(await response.json()) as NominatimResult[];
    if(!response.ok||!data.length)return NextResponse.json({error:"Ort wurde nicht gefunden."},{status:404});

    const ranked=data.map(item=>{
      const latitude=Number(item.lat);const longitude=Number(item.lon);
      return {...item,latitude,longitude,distanceKm:hasCenter?haversineKm(lat,lon,latitude,longitude):null};
    }).filter(item=>Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)).sort((a,b)=>{
      if(hasCenter&&a.distanceKm!=null&&b.distanceKm!=null)return a.distanceKm-b.distanceKm;
      return (b.importance??0)-(a.importance??0);
    });

    const nearest=ranked[0];
    if(!nearest)return NextResponse.json({error:"Ort wurde nicht gefunden."},{status:404});
    return NextResponse.json({
      latitude:nearest.latitude,
      longitude:nearest.longitude,
      name:nearest.display_name,
      distanceKm:nearest.distanceKm,
      results:ranked.slice(0,8).map(item=>({latitude:item.latitude,longitude:item.longitude,name:item.display_name,distanceKm:item.distanceKm}))
    });
  }catch{return NextResponse.json({error:"Suche ist gerade nicht verfügbar."},{status:502})}
}

async function searchNearbyPoi(query:string,lat:number,lon:number){
  const escaped=escapeOverpassRegex(query);
  const overpass=`[out:json][timeout:12];(nwr(around:20000,${lat},${lon})[name~"${escaped}",i];nwr(around:20000,${lat},${lon})[brand~"${escaped}",i];nwr(around:20000,${lat},${lon})[operator~"${escaped}",i];);out center tags 80;`;
  const response=await fetch("https://overpass-api.de/api/interpreter",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","User-Agent":"Firestarter-2026-PWA"},
    body:new URLSearchParams({data:overpass}),
    cache:"no-store"
  });
  if(!response.ok)return [];
  const json=await response.json() as {elements?:OverpassElement[]};
  const seen=new Set<string>();
  return (json.elements??[]).map(element=>{
    const latitude=element.lat??element.center?.lat;
    const longitude=element.lon??element.center?.lon;
    if(latitude==null||longitude==null)return null;
    const tags=element.tags??{};
    const name=tags.name||tags.brand||tags.operator||query;
    const address=[tags["addr:street"],tags["addr:housenumber"],tags["addr:postcode"],tags["addr:city"]].filter(Boolean).join(" ");
    const key=`${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if(seen.has(key))return null;seen.add(key);
    return {latitude,longitude,name:address?`${name}, ${address}`:name,distanceKm:haversineKm(lat,lon,latitude,longitude)};
  }).filter((item):item is {latitude:number;longitude:number;name:string;distanceKm:number}=>Boolean(item)).sort((a,b)=>a.distanceKm-b.distanceKm);
}

function escapeOverpassRegex(value:string){return value.replace(/[\\".*+?^${}()|[\]]/g,"\\$&")}
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){
  const r=6371;const toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1);const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
