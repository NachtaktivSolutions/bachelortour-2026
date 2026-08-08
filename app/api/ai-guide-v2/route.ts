import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { POST as legacyPost, GET as legacyGet } from "../ai-guide/route";

type Location={latitude:number;longitude:number};
type Place={id:string;name:string;address:string|null;latitude:number;longitude:number;rating?:number|null;openNow?:boolean|null};
type Action={type:string;label:string;subtitle?:string;navigationUrl?:string};

export async function GET(req:NextRequest){return legacyGet(req)}

export async function POST(req:NextRequest){
  let body:{question?:string;location?:Location|null};
  try{body=await req.clone().json()}catch{return legacyPost(req)}
  const question=String(body.question||"").trim();
  const category=detectNearbyCategory(question);
  if(!category)return legacyPost(req);

  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return NextResponse.json({error:"Du bist nicht angemeldet."},{status:401});
  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await supabase.auth.getUser(token);
  if(error||!user)return NextResponse.json({error:"Deine Sitzung ist abgelaufen. Bitte einmal neu anmelden."},{status:401});

  const location=validLocation(body.location)?body.location!:null;
  if(!location)return NextResponse.json({answer:"Dafür brauch ich kurz deinen Standort – sonst schicke ich euch am Ende in die falsche Kneipe. 😄",actions:[],needsLocation:true});

  const places=await searchPlaces(category,location);
  if(!places.length){
    return NextResponse.json({answer:`Ich habe gerade keine passenden ${labelFor(category)} im direkten Umkreis gefunden. Versuch’s gern mit „Bars“, „Restaurants“ oder einem etwas größeren Suchbegriff.`,actions:[],needsLocation:false});
  }

  const sorted=[...places].sort((a,b)=>{
    if(a.openNow===true&&b.openNow!==true)return-1;if(b.openNow===true&&a.openNow!==true)return 1;
    return (b.rating||0)-(a.rating||0);
  });
  const top=sorted.slice(0,5);
  const openCount=places.filter(p=>p.openNow===true).length;
  const best=top[0];
  const details=top.slice(0,3).map((p,i)=>`${i+1}. ${p.name}${typeof p.rating==="number"?` · ★ ${p.rating}`:""}${p.openNow===true?" · offen":p.openNow===false?" · geschlossen":""}`).join("\n");
  const answer=`Klar 🍺 Ich habe ${places.length} passende ${labelFor(category)} in deiner Nähe gefunden${openCount?` – ${openCount} davon sind gerade offen`:""}.\n\n${details}\n\n${best?`Ich würde zuerst ${best.name} anschauen.`:""} Die Navigation findest du direkt darunter. Viel Spaß – aber findet den Bus später wieder. 😄`;
  const actions:Action[]=top.map(p=>({type:"place",label:p.name,subtitle:[p.address,typeof p.rating==="number"?`★ ${p.rating}`:null,p.openNow===true?"Jetzt geöffnet":p.openNow===false?"Geschlossen":null].filter(Boolean).join(" · "),navigationUrl:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address||`${p.latitude},${p.longitude}`)}`}));
  return NextResponse.json({answer,actions,needsLocation:false});
}

function validLocation(v:unknown):v is Location{const l=v as Location|null;return Boolean(l&&Number.isFinite(l.latitude)&&Number.isFinite(l.longitude)&&Math.abs(l.latitude)<=90&&Math.abs(l.longitude)<=180)}

function detectNearbyCategory(q:string){
  const text=q.toLocaleLowerCase("de-DE");
  const hasNearby=/\b(in der nähe|in meiner nähe|hier|umgebung|umkreis|fußläufig|zu fuß|bei mir|um mich|drumherum|nahe)\b/.test(text);
  const hasIntent=/\b(wo|gibt|gibt's|gibts|finde|finden|suche|such|empfehl|nächste|nächsten|beste|gute|offen|geöffnet|hin)\b/.test(text);
  if(!(hasNearby||hasIntent))return null;
  if(/\b(kneipe|kneipen|pub|pubs|bar|bars|biergarten|biergärten)\b/.test(text))return"bar";
  if(/\b(club|clubs|disco|diskothek|tanzen)\b/.test(text))return"nightclub";
  if(/\b(restaurant|restaurants|essen|pizza|burger|frühstück|imbiss|döner)\b/.test(text))return"restaurant";
  if(/\b(café|cafe|cafés|cafes|kaffee)\b/.test(text))return"cafe";
  if(/\b(bäckerei|bäcker|backerei)\b/.test(text))return"bakery";
  if(/\b(supermarkt|supermärkte|lebensmittel)\b/.test(text))return"supermarket";
  if(/\b(apotheke|apotheken)\b/.test(text))return"pharmacy";
  if(/\b(geldautomat|geldautomaten|atm)\b/.test(text))return"atm";
  if(/\b(tankstelle|tankstellen|tanken)\b/.test(text))return"fuel";
  if(/\b(toilette|toiletten|klo|klos|wc)\b/.test(text))return"toilets";
  if(/\b(krankenhaus|klinikum|arzt|ärzte)\b/.test(text))return"hospital";
  if(/\b(polizei|polizeistation)\b/.test(text))return"police";
  if(/\b(taxi|taxis|taxistand)\b/.test(text))return"taxi";
  return null;
}

function labelFor(category:string){const m:Record<string,string>={bar:"Kneipen und Bars",nightclub:"Clubs",restaurant:"Restaurants",cafe:"Cafés",bakery:"Bäckereien",supermarket:"Supermärkte",pharmacy:"Apotheken",atm:"Geldautomaten",fuel:"Tankstellen",toilets:"Toiletten",hospital:"Krankenhäuser",police:"Polizeistationen",taxi:"Taxistände"};return m[category]||"Orte"}

async function searchPlaces(category:string,location:Location):Promise<Place[]>{
  if(process.env.GOOGLE_PLACES_API_KEY)try{
    const typeMap:Record<string,string>={bar:"bar",nightclub:"night_club",restaurant:"restaurant",cafe:"cafe",bakery:"bakery",supermarket:"supermarket",pharmacy:"pharmacy",atm:"atm",fuel:"gas_station",hospital:"hospital",police:"police",taxi:"taxi_stand"};
    const r=await fetch("https://places.googleapis.com/v1/places:searchNearby",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":process.env.GOOGLE_PLACES_API_KEY,"X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours.openNow"},body:JSON.stringify({includedTypes:[typeMap[category]||"bar"],maxResultCount:10,rankPreference:"POPULARITY",locationRestriction:{circle:{center:location,radius:4500}}})});
    if(r.ok){const d=await r.json();const rows=(d.places||[]).map((p:any)=>({id:p.id,name:p.displayName?.text||"Ort",address:p.formattedAddress||null,latitude:p.location?.latitude,longitude:p.location?.longitude,rating:p.rating??null,openNow:p.currentOpeningHours?.openNow??null})).filter((p:Place)=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));if(rows.length)return rows}
  }catch{}

  const filters:Record<string,string>={bar:'["amenity"~"^(bar|pub)$"]',nightclub:'["amenity"="nightclub"]',restaurant:'["amenity"~"^(restaurant|fast_food)$"]',cafe:'["amenity"="cafe"]',bakery:'["shop"="bakery"]',supermarket:'["shop"="supermarket"]',taxi:'["amenity"="taxi"]',atm:'["amenity"="atm"]',fuel:'["amenity"="fuel"]',toilets:'["amenity"="toilets"]',hospital:'["amenity"~"^(hospital|clinic)$"]',police:'["amenity"="police"]',pharmacy:'["amenity"="pharmacy"]'};
  const f=filters[category]||filters.bar;
  const query=`[out:json][timeout:12];(node${f}(around:4500,${location.latitude},${location.longitude});way${f}(around:4500,${location.latitude},${location.longitude});relation${f}(around:4500,${location.latitude},${location.longitude}););out center tags 30;`;
  try{const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"Firestarter-2026-AI-Guide"},body:new URLSearchParams({data:query})});if(!r.ok)return[];const d=await r.json();return(d.elements||[]).map((e:any)=>({id:`${e.type}${e.id}`,name:e.tags?.name||labelFor(category),address:[e.tags?.["addr:street"],e.tags?.["addr:housenumber"],e.tags?.["addr:city"]].filter(Boolean).join(" ")||null,latitude:e.lat??e.center?.lat,longitude:e.lon??e.center?.lon})).filter((p:Place)=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).slice(0,10)}catch{return[]}
}
