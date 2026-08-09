import { NextRequest, NextResponse } from "next/server";
import { encrypt, requireAdmin, redirectUri, spotifyClientId } from "@/lib/spotify-server";

export async function POST(request:NextRequest){
  try{
    const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
    const {user}=await requireAdmin(token);
    const state=encrypt(JSON.stringify({accessToken:token,userId:user.id,ts:Date.now()}));
    const url=new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id",spotifyClientId());
    url.searchParams.set("response_type","code");
    url.searchParams.set("redirect_uri",redirectUri());
    url.searchParams.set("state",state);
    url.searchParams.set("scope","user-read-playback-state user-modify-playback-state user-read-currently-playing");
    url.searchParams.set("show_dialog","true");
    return NextResponse.json({url:url.toString()});
  }catch(error){const msg=error instanceof Error?error.message:"UNKNOWN";return NextResponse.json({error:msg},{status:msg==="FORBIDDEN"?403:401})}
}
