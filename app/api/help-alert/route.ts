import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const token=req.headers.get("authorization")?.replace("Bearer ","");
    if(!token)return NextResponse.json({error:"Nicht angemeldet."},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service=process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
    const {data:{user}}=await userClient.auth.getUser(token);
    if(!user)return NextResponse.json({error:"Ungültige Sitzung."},{status:401});
    const admin=createClient(url,service);
    const {data:profile}=await admin.from("profiles").select("name").eq("id",user.id).single();
    if(!profile)return NextResponse.json({error:"Profil nicht gefunden."},{status:404});

    const {latitude,longitude,accuracy}=await req.json();
    const {data:last}=await admin.from("help_alerts").select("created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(last&&Date.now()-new Date(last.created_at).getTime()<60_000)return NextResponse.json({error:"Der Hilferuf wurde bereits gesendet. Bitte warte kurz."},{status:429});

    await admin.from("profiles").update({participant_status:"brauche Hilfe",status_updated_at:new Date().toISOString(),share_location:true,latitude:latitude??null,longitude:longitude??null,location_updated_at:new Date().toISOString()}).eq("id",user.id);
    const {data:alert,error}=await admin.from("help_alerts").insert({user_id:user.id,latitude:latitude??null,longitude:longitude??null,accuracy:accuracy??null}).select("id").single();
    if(error)throw error;

    const vapidPublic=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate=process.env.VAPID_PRIVATE_KEY;
    const vapidSubject=process.env.VAPID_SUBJECT||process.env.NEXT_PUBLIC_SITE_URL||"https://bachelortour-2026.vercel.app";
    let sent=0;
    if(vapidPublic&&vapidPrivate){
      webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);
      const {data:subscriptions}=await admin.from("push_subscriptions").select("*");
      await Promise.all((subscriptions??[]).map(async row=>{
        try{await webpush.sendNotification(row.subscription,JSON.stringify({title:"🚨 HILFE BENÖTIGT!",body:`${profile.name} benötigt Hilfe. Standort wurde geteilt.`,url:"/map",tag:`help-${alert.id}`}));sent++}
        catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await admin.from("push_subscriptions").delete().eq("id",row.id)}
      }));
    }
    return NextResponse.json({sent,alertId:alert.id});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Hilferuf fehlgeschlagen."},{status:500})}
}
