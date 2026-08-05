import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(req:NextRequest){
 const token=req.headers.get("authorization")?.replace("Bearer ","");if(!token)return NextResponse.json({error:"Nicht angemeldet."},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,service=process.env.SUPABASE_SERVICE_ROLE_KEY!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});const{data:{user}}=await userClient.auth.getUser(token);if(!user)return NextResponse.json({error:"Ungültige Sitzung."},{status:401});
 const admin=createClient(url,service);const{data:me}=await admin.from("profiles").select("is_admin").eq("id",user.id).single();if(!me?.is_admin)return NextResponse.json({error:"Nur Admins."},{status:403});
 const[{data:profiles},{data:devices},{data:subs}]=await Promise.all([admin.from("profiles").select("id,name,avatar_url,share_location").order("name"),admin.from("device_status").select("*"),admin.from("push_subscriptions").select("user_id")]);
 const subUsers=new Set((subs??[]).map(s=>s.user_id));const byUser=new Map((devices??[]).map(d=>[d.user_id,d]));
 return NextResponse.json({members:(profiles??[]).map(p=>({...p,device:byUser.get(p.id)??null,push_registered:subUsers.has(p.id)}))});
}
