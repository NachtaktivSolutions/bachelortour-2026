"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Luggage, ShieldCheck } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Settings={is_visible:boolean;title:string;intro:string|null};
type Category={id:string;name:string;description:string|null;sort_order:number};
type Item={id:string;category_id:string;title:string;description:string|null;is_required:boolean;sort_order:number};

export default function PackingListPage(){
  const {profile}=useApp();
  const supabase=createClient();
  const [settings,setSettings]=useState<Settings|null>(null);
  const [categories,setCategories]=useState<Category[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [checked,setChecked]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    if(!profile)return;
    const [s,c,i,ch]=await Promise.all([
      supabase.from("packing_settings").select("is_visible,title,intro").eq("id",1).maybeSingle(),
      supabase.from("packing_categories").select("*").order("sort_order").order("created_at"),
      supabase.from("packing_items").select("*").order("sort_order").order("created_at"),
      supabase.from("packing_checks").select("item_id").eq("user_id",profile.id).eq("checked",true)
    ]);
    setSettings(s.data);setCategories(c.data??[]);setItems(i.data??[]);setChecked(new Set((ch.data??[]).map(row=>row.item_id)));setLoading(false);
  },[profile?.id,supabase]);

  useEffect(()=>{load();const channel=supabase.channel("packing-live").on("postgres_changes",{event:"*",schema:"public",table:"packing_settings"},load).on("postgres_changes",{event:"*",schema:"public",table:"packing_categories"},load).on("postgres_changes",{event:"*",schema:"public",table:"packing_items"},load).subscribe();return()=>{supabase.removeChannel(channel)}},[load,supabase]);

  async function toggle(itemId:string){
    if(!profile)return;
    const active=checked.has(itemId);
    setChecked(current=>{const next=new Set(current);active?next.delete(itemId):next.add(itemId);return next});
    if(active) await supabase.from("packing_checks").delete().eq("user_id",profile.id).eq("item_id",itemId);
    else await supabase.from("packing_checks").upsert({user_id:profile.id,item_id:itemId,checked:true,checked_at:new Date().toISOString()});
  }

  const progress=items.length?Math.round(checked.size/items.length*100):0;
  const grouped=useMemo(()=>categories.map(category=>({...category,items:items.filter(item=>item.category_id===category.id)})).filter(group=>group.items.length),[categories,items]);

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">NICHTS VERGESSEN</span><h1>{settings?.title||"Packliste"}</h1><p>{settings?.intro||"Hake ab, was schon im Gepäck ist."}</p></div>
    {loading?<div className="empty-card">Packliste wird geladen …</div>:!settings?.is_visible&&!profile?.is_admin?<div className="empty-card"><Luggage/>Die Packliste ist noch geheim. Du bekommst Bescheid, sobald sie freigeschaltet wird.</div>:<>
      <section className="packing-progress"><div><strong>{checked.size} von {items.length}</strong><span>eingepackt</span></div><div className="packing-progress-track"><span style={{width:`${progress}%`}}/></div><b>{progress}%</b></section>
      {profile?.is_admin&&!settings?.is_visible&&<div className="status"><ShieldCheck/>Admin-Vorschau: Für Teilnehmer ist diese Liste aktuell unsichtbar.</div>}
      <div className="packing-groups">{grouped.map(group=><section className="packing-category" key={group.id}><header><div><h2>{group.name}</h2>{group.description&&<p>{group.description}</p>}</div><span>{group.items.filter(item=>checked.has(item.id)).length}/{group.items.length}</span></header><div>{group.items.map(item=>{const done=checked.has(item.id);return <button key={item.id} className={`packing-item ${done?"done":""}`} onClick={()=>toggle(item.id)}><span className="packing-check">{done&&<Check/>}</span><span><strong>{item.title}{item.is_required&&<em>Pflicht</em>}</strong>{item.description&&<small>{item.description}</small>}</span></button>})}</div></section>)}</div>
      {!items.length&&<div className="empty-card">Noch keine Gegenstände eingetragen.</div>}
    </>}
  </Shell></AuthGate>;
}
