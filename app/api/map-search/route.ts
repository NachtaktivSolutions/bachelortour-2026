import { NextRequest, NextResponse } from "next/server";

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get("q")?.trim();
  if(!q)return NextResponse.json({error:"Suchbegriff fehlt."},{status:400});
  try{
    const url=new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q",q);url.searchParams.set("format","jsonv2");url.searchParams.set("limit","1");url.searchParams.set("countrycodes","de");
    const response=await fetch(url,{headers:{"User-Agent":"Firestarter-2026-PWA"},next:{revalidate:300}});
    const data=await response.json();
    if(!response.ok||!data[0])return NextResponse.json({error:"Ort wurde nicht gefunden."},{status:404});
    return NextResponse.json({latitude:Number(data[0].lat),longitude:Number(data[0].lon),name:data[0].display_name});
  }catch{return NextResponse.json({error:"Suche ist gerade nicht verfügbar."},{status:502})}
}
