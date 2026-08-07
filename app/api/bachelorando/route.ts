import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||"https://bachelortour-2026.vercel.app";

async function getContext(req:NextRequest){
  const token=req.headers.get("authorization")?.replace("Bearer ","");
  if(!token)return{error:"Nicht angemeldet.",status:401} as const;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await userClient.auth.getUser(token);
  if(!user)return{error:"Ungültige Sitzung.",status:401} as const;
  const admin=createClient(url,service);
  const {data:profile}=await admin.from("profiles").select("id,name,is_admin").eq("id",user.id).single();
  if(!profile)return{error:"Profil nicht gefunden.",status:404} as const;
  return{admin,user,profile} as const;
}

async function isNewBachelor(admin:any,userId:string){
  const {data}=await admin.from("member_stamps").select("label").eq("user_id",userId).ilike("label","%Neu-Bachelor%").maybeSingle();
  return Boolean(data);
}

async function bachelorandoEnabled(admin:any){
  const {data}=await admin.from("app_settings").select("bachelorando_enabled").eq("id",1).maybeSingle();
  return data?.bachelorando_enabled!==false;
}

async function sendPush(admin:any,userIds:string[],payload:{title:string;body:string;url:string;tag:string}){
  if(!userIds.length)return 0;
  const vapidPublic=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate=process.env.VAPID_PRIVATE_KEY;
  const vapidSubject=process.env.VAPID_SUBJECT||siteUrl;
  if(!vapidPublic||!vapidPrivate)return 0;
  webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);
  const {data:subscriptions}=await admin.from("push_subscriptions").select("id,user_id,subscription").in("user_id",userIds);
  let sent=0;
  await Promise.all((subscriptions??[]).map(async(row:any)=>{
    try{await webpush.sendNotification(row.subscription,JSON.stringify({...payload,timestamp:Date.now()}),{TTL:3600,urgency:"high"});sent++}
    catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await admin.from("push_subscriptions").delete().eq("id",row.id)}
  }));
  return sent;
}

export async function GET(req:NextRequest){
  try{
    const ctx=await getContext(req);if("error"in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});
    const [{data:orders,error},{data:stamp},enabled]=await Promise.all([
      ctx.admin.from("bachelorando_orders").select("*, requester:profiles!bachelorando_orders_requester_id_fkey(name,avatar_url), courier:profiles!bachelorando_orders_claimed_by_fkey(name,avatar_url)").neq("status","cancelled").order("created_at",{ascending:false}).limit(50),
      ctx.admin.from("member_stamps").select("label").eq("user_id",ctx.user.id).ilike("label","%Neu-Bachelor%").maybeSingle(),
      bachelorandoEnabled(ctx.admin)
    ]);
    if(error)throw error;
    return NextResponse.json({orders:orders??[],isNewBachelor:Boolean(stamp),enabled,isAdmin:Boolean(ctx.profile.is_admin)});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Bachelorando konnte nicht geladen werden."},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const ctx=await getContext(req);if("error"in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});
    const body=await req.json();
    const action=String(body.action||"create");

    if(action==="toggle"){
      if(!ctx.profile.is_admin)return NextResponse.json({error:"Nur Admins dürfen Bachelorando aktivieren oder deaktivieren."},{status:403});
      const enabled=Boolean(body.enabled);
      const {error}=await ctx.admin.from("app_settings").update({bachelorando_enabled:enabled,updated_at:new Date().toISOString(),updated_by:ctx.user.id}).eq("id",1);
      if(error)throw error;
      return NextResponse.json({ok:true,enabled});
    }

    const enabled=await bachelorandoEnabled(ctx.admin);
    if(!enabled)return NextResponse.json({error:"Bachelorando ist aktuell geschlossen. Heute musst du selbst schauen, wie du an dein Bier kommst. 🍺😄"},{status:423});

    if(action==="create"){
      const item=String(body.item||"").trim();const seat=String(body.seat||"").trim();const note=String(body.note||"").trim();
      const quantity=Math.max(1,Math.min(20,Number(body.quantity)||1));
      if(!item||item.length>80)return NextResponse.json({error:"Bitte eine Bestellung angeben."},{status:400});
      if(!seat||seat.length>80)return NextResponse.json({error:"Bitte Platznummer oder Standort angeben."},{status:400});
      if(note.length>240)return NextResponse.json({error:"Bemerkung ist zu lang."},{status:400});
      const {data:order,error}=await ctx.admin.from("bachelorando_orders").insert({requester_id:ctx.user.id,item,quantity,seat,note:note||null}).select("id").single();if(error)throw error;
      const {data:stamps}=await ctx.admin.from("member_stamps").select("user_id").ilike("label","%Neu-Bachelor%");
      const targetIds=[...new Set((stamps??[]).map((row:any)=>String(row.user_id)).filter(Boolean))];
      const detail=`${quantity}× ${item} · ${seat}${note?` · ${note}`:""}`;
      const sent=await sendPush(ctx.admin,targetIds,{title:"🍺 Neue Bachelorando-Bestellung",body:`${ctx.profile.name} möchte ${detail}`,url:"/bachelorando",tag:`bachelorando-${order.id}`});
      return NextResponse.json({ok:true,orderId:order.id,sent});
    }

    const orderId=String(body.orderId||"");if(!orderId)return NextResponse.json({error:"Bestellung fehlt."},{status:400});
    const {data:order}=await ctx.admin.from("bachelorando_orders").select("*").eq("id",orderId).single();if(!order)return NextResponse.json({error:"Bestellung nicht gefunden."},{status:404});
    const requester=order.requester_id===ctx.user.id;const newBachelor=await isNewBachelor(ctx.admin,ctx.user.id);

    if(action==="claim"){
      if(!newBachelor)return NextResponse.json({error:"Nur Neu-Bachelor dürfen Bestellungen übernehmen."},{status:403});
      if(order.status!=="open")return NextResponse.json({error:"Diese Bestellung wurde bereits übernommen."},{status:409});
      const now=new Date().toISOString();const {data:updated,error}=await ctx.admin.from("bachelorando_orders").update({status:"claimed",claimed_by:ctx.user.id,claimed_at:now,updated_at:now}).eq("id",orderId).eq("status","open").select("id").maybeSingle();if(error)throw error;if(!updated)return NextResponse.json({error:"Da war jemand schneller."},{status:409});
      await sendPush(ctx.admin,[order.requester_id],{title:"🍺 Bachelorando ist unterwegs",body:`${ctx.profile.name} übernimmt deine Bestellung: ${order.quantity}× ${order.item}.`,url:"/bachelorando",tag:`bachelorando-claimed-${orderId}`});return NextResponse.json({ok:true});
    }
    if(action==="deliver"){
      if(!requester&&!newBachelor)return NextResponse.json({error:"Nur der Besteller oder ein Neu-Bachelor kann diese Bestellung erledigen."},{status:403});
      if(order.status==="delivered")return NextResponse.json({error:"Diese Bestellung ist bereits erledigt."},{status:400});if(order.status==="cancelled")return NextResponse.json({error:"Stornierte Bestellungen können nicht erledigt werden."},{status:400});
      const now=new Date().toISOString();const deliveredBy=order.claimed_by||(!requester&&newBachelor?ctx.user.id:null);const {error}=await ctx.admin.from("bachelorando_orders").update({status:"delivered",claimed_by:deliveredBy,claimed_at:order.claimed_at||(!requester&&newBachelor?now:null),delivered_at:now,updated_at:now}).eq("id",orderId);if(error)throw error;
      if(!requester)await sendPush(ctx.admin,[order.requester_id],{title:"✅ Bachelorando erledigt",body:`${order.quantity}× ${order.item} wurde als erledigt markiert. Prost!`,url:"/bachelorando",tag:`bachelorando-delivered-${orderId}`});return NextResponse.json({ok:true});
    }
    if(action==="cancel"){
      if(!requester&&!newBachelor)return NextResponse.json({error:"Nur der Besteller oder ein Neu-Bachelor kann stornieren."},{status:403});
      if(order.status==="delivered")return NextResponse.json({error:"Erledigte Bestellungen können nicht storniert werden."},{status:400});if(order.status==="cancelled")return NextResponse.json({error:"Diese Bestellung ist bereits storniert."},{status:400});
      const now=new Date().toISOString();const {error}=await ctx.admin.from("bachelorando_orders").update({status:"cancelled",updated_at:now}).eq("id",orderId);if(error)throw error;
      if(!requester)await sendPush(ctx.admin,[order.requester_id],{title:"❌ Bachelorando storniert",body:`${ctx.profile.name} hat deine Bestellung ${order.quantity}× ${order.item} storniert.`,url:"/bachelorando",tag:`bachelorando-cancelled-${orderId}`});return NextResponse.json({ok:true});
    }
    return NextResponse.json({error:"Unbekannte Aktion."},{status:400});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Bachelorando-Aktion fehlgeschlagen."},{status:500})}
}
