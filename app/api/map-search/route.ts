import { NextRequest, NextResponse } from "next/server";

type NominatimResult={lat:string;lon:string;display_name:string;importance?:number};

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get("q")?.trim();
  const lat=Number(req.nextUrl.searchParams.get("lat"));
  const lon=Number(req.nextUrl.searchParams.get("lon"));
  const hasCenter=Number.isFinite(lat)&&Number.isFinite(lon);
  if(!q)return NextResponse.json({error:"Suchbegriff fehlt."},{status:400});

  try{
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q",q);
    url.searchParams.set("format","jsonv2");
    url.searchParams.set("limit","10");
    url.searchParams.set("countrycodes","de");
    url.searchParams.set("addressdetails","1");

    // Die Viewbox gewichtet Treffer im Umkreis stark, ohne eine bundesweite Suche komplett auszuschließen.
    if(hasCenter){
      const latDelta=0.25; // ungefähr 28 km Nord/Süd
      const lonDelta=0.38; // ungefähr 28 km Ost/West in Süddeutschland
      url.searchParams.set("viewbox",`${lon-lonDelta},${lat+latDelta},${lon+lonDelta},${lat-latDelta}`);
      url.searchParams.set("bounded","0");
    }

    const response=await fetch(url,{headers:{"User-Agent":"Firestarter-2026-PWA"},cache:"no-store"});
    const data=(await response.json()) as NominatimResult[];
    if(!response.ok||!data.length)return NextResponse.json({error:"Ort wurde nicht gefunden."},{status:404});

    const ranked=data.map(item=>{
      const latitude=Number(item.lat);const longitude=Number(item.lon);
      return {...item,latitude,longitude,distanceKm:hasCenter?haversineKm(lat,lon,latitude,longitude):null};
    }).sort((a,b)=>{
      if(hasCenter&&a.distanceKm!=null&&b.distanceKm!=null)return a.distanceKm-b.distanceKm;
      return (b.importance??0)-(a.importance??0);
    });

    const nearest=ranked[0];
    return NextResponse.json({
      latitude:nearest.latitude,
      longitude:nearest.longitude,
      name:nearest.display_name,
      distanceKm:nearest.distanceKm,
      results:ranked.slice(0,5).map(item=>({latitude:item.latitude,longitude:item.longitude,name:item.display_name,distanceKm:item.distanceKm}))
    });
  }catch{return NextResponse.json({error:"Suche ist gerade nicht verfügbar."},{status:502})}
}

function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){
  const r=6371;const toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(lat2-lat1);const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
