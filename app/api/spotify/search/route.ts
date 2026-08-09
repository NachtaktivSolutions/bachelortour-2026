import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, spotifyFetch } from "@/lib/spotify-server";

export async function GET(request:NextRequest){
  try{
    const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
    const {sb}=await requireAdmin(token);
    const q=request.nextUrl.searchParams.get("q")?.trim()||"";
    if(q.length<3)return NextResponse.json({tracks:[]});
    const res=await spotifyFetch(sb,`/search?type=track&limit=8&q=${encodeURIComponent(q)}`);
    if(!res.ok)return NextResponse.json({error:"Spotify-Suche fehlgeschlagen."},{status:res.status});
    const json=await res.json() as any;
    const tracks=(json.tracks?.items??[]).map((t:any)=>({id:t.id,uri:t.uri,title:t.name,artist:(t.artists??[]).map((a:any)=>a.name).join(", "),album:t.album?.name??"",image:t.album?.images?.[1]?.url??t.album?.images?.[0]?.url??null,durationMs:t.duration_ms??0,externalUrl:t.external_urls?.spotify??null}));
    return NextResponse.json({tracks});
  }catch(error){const msg=error instanceof Error?error.message:"UNKNOWN";return NextResponse.json({error:msg},{status:msg==="FORBIDDEN"?403:401})}
}
