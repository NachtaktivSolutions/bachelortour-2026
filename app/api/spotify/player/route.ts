import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser, spotifyFetch } from "@/lib/spotify-server";

function bearer(request:NextRequest){return request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||""}

type SpotifyPlayback = {
  item?: any;
  progress_ms?: number | null;
  is_playing?: boolean;
  device?: { id?: string; name?: string } | null;
};

function normalizeCurrent(primary:SpotifyPlayback|null,secondary:SpotifyPlayback|null){
  const source=primary?.item?primary:secondary?.item?secondary:null;
  const item=source?.item;
  if(!item)return null;
  const isTrack=item.type==="track";
  return {
    id:item.id,
    uri:item.uri,
    title:item.name,
    artist:isTrack?(item.artists??[]).map((a:any)=>a.name).join(", "):(item.show?.name??"Spotify"),
    image:isTrack?(item.album?.images?.[1]?.url??item.album?.images?.[0]?.url??null):(item.images?.[1]?.url??item.images?.[0]?.url??null),
    progressMs:Math.max(primary?.progress_ms??0,secondary?.progress_ms??0),
    durationMs:item.duration_ms??0,
    // Spotify Connect can occasionally report different play states on its
    // two playback endpoints. Treat either positive signal as authoritative.
    isPlaying:Boolean(primary?.is_playing||secondary?.is_playing),
    device:(primary?.device||secondary?.device)?{
      id:(primary?.device?.id||secondary?.device?.id||""),
      name:(primary?.device?.name||secondary?.device?.name||"Spotify")
    }:null
  };
}

export async function GET(request:NextRequest){
  try{
    const {sb,profile}=await requireUser(bearer(request));

    // Query both Spotify playback endpoints. On Spotify Connect (especially
    // iPad/tablet) one can briefly report is_playing=false while the other is
    // already correct. Combining both avoids hiding the participant jukebox.
    const [stateRes,currentlyRes]=await Promise.all([
      spotifyFetch(sb,"/me/player?additional_types=track,episode"),
      spotifyFetch(sb,"/me/player/currently-playing?additional_types=track,episode")
    ]);

    const state:SpotifyPlayback|null=stateRes.status!==204&&stateRes.ok?await stateRes.json():null;
    const currently:SpotifyPlayback|null=currentlyRes.status!==204&&currentlyRes.ok?await currentlyRes.json():null;
    const current=normalizeCurrent(state,currently);

    if(!profile?.is_admin)return NextResponse.json({connected:true,current,devices:[],account:null});

    const [devicesRes,authResult]=await Promise.all([
      spotifyFetch(sb,"/me/player/devices"),
      sb.from("jukebox_spotify_auth").select("spotify_display_name,spotify_user_id,connected_at").eq("id",1).maybeSingle()
    ]);
    const devicesJson=devicesRes.ok?await devicesRes.json() as any:{devices:[]};
    return NextResponse.json({
      connected:true,
      account:authResult.data??null,
      devices:(devicesJson.devices??[]).map((d:any)=>({id:d.id,name:d.name,type:d.type,isActive:d.is_active,volume:d.volume_percent})),
      current
    });
  }catch(error){
    const msg=error instanceof Error?error.message:"UNKNOWN";
    return NextResponse.json({connected:false,error:msg},{status:msg==="FORBIDDEN"?403:401});
  }
}

export async function POST(request:NextRequest){
  try{
    const {sb}=await requireAdmin(bearer(request));
    const body=await request.json() as {action:string;uri?:string;deviceId?:string};
    let res:Response;

    if(body.action==="play"&&body.uri){
      const queueDevice=body.deviceId?`&device_id=${encodeURIComponent(body.deviceId)}`:"";
      const queued=await spotifyFetch(sb,`/me/player/queue?uri=${encodeURIComponent(body.uri)}${queueDevice}`,{method:"POST"});
      if(!queued.ok&&queued.status!==204){const text=await queued.text();return NextResponse.json({error:text||"Song konnte nicht in die Spotify-Warteschlange gelegt werden."},{status:queued.status});}
      const nextDevice=body.deviceId?`?device_id=${encodeURIComponent(body.deviceId)}`:"";
      res=await spotifyFetch(sb,`/me/player/next${nextDevice}`,{method:"POST"});
    }
    else if(body.action==="queue"&&body.uri){const qs=body.deviceId?`&device_id=${encodeURIComponent(body.deviceId)}`:"";res=await spotifyFetch(sb,`/me/player/queue?uri=${encodeURIComponent(body.uri)}${qs}`,{method:"POST"});}
    else if(body.action==="skip"){const qs=body.deviceId?`?device_id=${encodeURIComponent(body.deviceId)}`:"";res=await spotifyFetch(sb,`/me/player/next${qs}`,{method:"POST"});}
    else if(body.action==="pause"){const qs=body.deviceId?`?device_id=${encodeURIComponent(body.deviceId)}`:"";res=await spotifyFetch(sb,`/me/player/pause${qs}`,{method:"PUT"});}
    else if(body.action==="resume"){const qs=body.deviceId?`?device_id=${encodeURIComponent(body.deviceId)}`:"";res=await spotifyFetch(sb,`/me/player/play${qs}`,{method:"PUT"});}
    else if(body.action==="transfer"&&body.deviceId){res=await spotifyFetch(sb,"/me/player",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({device_ids:[body.deviceId],play:false})});}
    else return NextResponse.json({error:"Ungültige Aktion."},{status:400});

    if(!res.ok&&res.status!==204){const text=await res.text();return NextResponse.json({error:text||"Spotify-Aktion fehlgeschlagen."},{status:res.status});}
    return NextResponse.json({ok:true});
  }catch(error){
    const msg=error instanceof Error?error.message:"UNKNOWN";
    return NextResponse.json({error:msg},{status:msg==="FORBIDDEN"?403:401});
  }
}
