import { NextRequest, NextResponse } from "next/server";

const filters:Record<string,string>={bar:'["amenity"="bar"]',nightclub:'["amenity"="nightclub"]',restaurant:'["amenity"="restaurant"]',hotel:'["tourism"="hotel"]',taxi:'["amenity"="taxi"]',atm:'["amenity"="atm"]',fuel:'["amenity"="fuel"]',toilets:'["amenity"="toilets"]',hospital:'["amenity"="hospital"]',police:'["amenity"="police"]',pharmacy:'["amenity"="pharmacy"]'};

export async function GET(req:NextRequest){
  const p=req.nextUrl.searchParams;const lat=Number(p.get("lat"));const lon=Number(p.get("lon"));const radius=Math.min(5000,Math.max(500,Number(p.get("radius"))||2500));
  const categories=(p.get("categories")||"").split(",").filter(c=>filters[c]).slice(0,11);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||!categories.length)return NextResponse.json({pois:[]});
  const parts=categories.flatMap(c=>[`node${filters[c]}(around:${radius},${lat},${lon});`,`way${filters[c]}(around:${radius},${lat},${lon});`,`relation${filters[c]}(around:${radius},${lat},${lon});`]);
  const query=`[out:json][timeout:18];(${parts.join("")});out center tags 100;`;
  try{
    const response=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"Firestarter-2026-PWA"},body:new URLSearchParams({data:query}),next:{revalidate:300}});
    if(!response.ok)throw new Error("POI-Dienst nicht erreichbar");
    const data=await response.json();
    const pois=(data.elements??[]).map((e:any)=>{const category=detectCategory(e.tags??{});const latitude=e.lat??e.center?.lat;const longitude=e.lon??e.center?.lon;return{id:String(e.type)+String(e.id),name:e.tags?.name||label(category),category,latitude,longitude,address:[e.tags?.["addr:street"],e.tags?.["addr:housenumber"],e.tags?.["addr:city"]].filter(Boolean).join(" ")||null}}).filter((x:any)=>x.category&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
    return NextResponse.json({pois});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"POIs konnten nicht geladen werden.",pois:[]},{status:502})}
}
function detectCategory(t:Record<string,string>){for(const [key,value] of Object.entries(filters)){const m=value.match(/\["([^"]+)"="([^"]+)"\]/);if(m&&t[m[1]]===m[2])return key}return""}
function label(c:string){return({bar:"Bar",nightclub:"Club",restaurant:"Restaurant",hotel:"Hotel",taxi:"Taxi",atm:"Geldautomat",fuel:"Tankstelle",toilets:"Toilette",hospital:"Krankenhaus",police:"Polizei",pharmacy:"Apotheke"} as Record<string,string>)[c]||"POI"}
