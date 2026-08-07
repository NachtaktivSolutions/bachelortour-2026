import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getContext(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Nicht angemeldet.", status: 401 } as const;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return { error: "Ungültige Sitzung.", status: 401 } as const;
  const admin = createClient(url, service);
  const { data: profile } = await admin.from("profiles").select("id,name,is_admin").eq("id", user.id).single();
  if (!profile) return { error: "Profil nicht gefunden.", status: 404 } as const;
  return { admin, user, profile } as const;
}

async function getEnabled(admin:any){
  const {data}=await admin.from("app_settings").select("tour_burn_enabled").eq("id",1).maybeSingle();
  return Boolean(data?.tour_burn_enabled);
}

export async function GET(req:NextRequest){
  try{
    const ctx=await getContext(req);if("error" in ctx)return NextResponse.json({error:ctx.error},{status:ctx.status});
    const enabled=await getEnabled(ctx.admin);
    const burned=!ctx.profile.is_admin&&Boolean(ctx.user.app_metadata?.tour_burned);
    return NextResponse.json({enabled,burned,isAdmin:Boolean(ctx.profile.is_admin),burnedAt:ctx.user.app_metadata?.tour_burned_at||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Status konnte nicht geladen werden."},{status:500})}
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "toggle") {
      if (!ctx.profile.is_admin) return NextResponse.json({ error: "Nur Admins dürfen die Tour-Verbrennung freischalten." }, { status: 403 });
      const enabled = Boolean(body.enabled);
      const { error } = await ctx.admin.from("app_settings").update({ tour_burn_enabled: enabled, tour_burned:false, tour_burned_at:null, tour_burned_by:null, updated_at: new Date().toISOString(), updated_by: ctx.user.id }).eq("id", 1);
      if (error) throw error;
      return NextResponse.json({ ok: true, enabled });
    }

    if (action === "burn") {
      if(ctx.profile.is_admin)return NextResponse.json({error:"Admin-Zugänge können nicht verbrannt werden."},{status:403});
      const enabled=await getEnabled(ctx.admin);
      if(!enabled)return NextResponse.json({error:"Die Tour-Verbrennung ist aktuell nicht freigeschaltet."},{status:409});
      if(ctx.user.app_metadata?.tour_burned)return NextResponse.json({ok:true,burned:true,alreadyBurned:true});
      const now=new Date().toISOString();
      const appMetadata={...(ctx.user.app_metadata||{}),tour_burned:true,tour_burned_at:now};
      const {error}=await ctx.admin.auth.admin.updateUserById(ctx.user.id,{app_metadata:appMetadata});
      if(error)throw error;
      return NextResponse.json({ ok:true,burned:true,burnedAt:now });
    }

    if (action === "reset") {
      if (!ctx.profile.is_admin) return NextResponse.json({ error: "Nur Admins dürfen die Verbrennungen global zurücksetzen." }, { status: 403 });
      let page=1;let cleared=0;
      while(true){
        const {data,error}=await ctx.admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;
        const users=data.users||[];
        for(const user of users){
          if(!user.app_metadata?.tour_burned)continue;
          const meta={...(user.app_metadata||{}),tour_burned:false,tour_burned_at:null};
          const {error:updateError}=await ctx.admin.auth.admin.updateUserById(user.id,{app_metadata:meta});if(updateError)throw updateError;
          cleared++;
        }
        if(users.length<1000)break;page++;
      }
      const now=new Date().toISOString();
      const { error } = await ctx.admin.from("app_settings").update({ tour_burned:false,tour_burned_at:null,tour_burned_by:null,updated_at:now,updated_by:ctx.user.id }).eq("id", 1);
      if (error) throw error;
      return NextResponse.json({ ok:true,cleared });
    }

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tour-Verbrennung fehlgeschlagen." }, { status: 500 });
  }
}
