import { NextRequest, NextResponse } from "next/server";
import { decrypt, encrypt, requireAdmin, redirectUri, spotifyClientId } from "@/lib/spotify-server";

export async function GET(request:NextRequest){
  try{
    const code=request.nextUrl.searchParams.get("code")||"";
    const state=request.nextUrl.searchParams.get("state")||"";
    const decoded=JSON.parse(decrypt(state)) as {accessToken:string;userId:string;ts:number};
    if(!decoded.accessToken||Date.now()-decoded.ts>10*60*1000)throw new Error("STATE_EXPIRED");
    const {sb,user}=await requireAdmin(decoded.accessToken);
    if(user.id!==decoded.userId)throw new Error("STATE_MISMATCH");
    const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:redirectUri()});
    const tokenRes=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${spotifyClientId()}:${process.env.SPOTIFY_CLIENT_SECRET!}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
    if(!tokenRes.ok)throw new Error("TOKEN_EXCHANGE_FAILED");
    const tokens=await tokenRes.json() as {access_token:string;refresh_token:string};
    const meRes=await fetch("https://api.spotify.com/v1/me",{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store"});
    const me=meRes.ok?await meRes.json() as {id?:string;display_name?:string}:{};
    const {error}=await sb.from("jukebox_spotify_auth").upsert({id:1,encrypted_refresh_token:encrypt(tokens.refresh_token),spotify_user_id:me.id??null,spotify_display_name:me.display_name??null,connected_by:user.id,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    if(error)throw error;
    return NextResponse.redirect(new URL("/?spotify=connected#jukebox",request.url));
  }catch{
    return NextResponse.redirect(new URL("/?spotify=error#jukebox",request.url));
  }
}
