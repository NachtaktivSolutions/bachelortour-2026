"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BedDouble, KeyRound, Pencil, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import "./hotel-room-card.css";

type RoomCredentials={
  room_number:string;
  room_pin:string;
};

export function HotelRoomCard({hotelId,hotelName}:{hotelId:string;hotelName:string}){
  const { profile }=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [room,setRoom]=useState<RoomCredentials|null>(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  useEffect(()=>{
    if(!profile?.id||!hotelId)return;
    let active=true;
    supabase.from("hotel_room_credentials").select("room_number,room_pin").eq("user_id",profile.id).eq("hotel_id",hotelId).maybeSingle().then(({data})=>{
      if(active)setRoom(data??null);
    });
    return()=>{active=false};
  },[profile?.id,hotelId,supabase]);

  useEffect(()=>{
    if(!open)return;
    const old=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=old};
  },[open]);

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!profile?.id||!hotelId)return;
    const form=new FormData(e.currentTarget);
    const roomNumber=String(form.get("room_number")||"").trim();
    const roomPin=String(form.get("room_pin")||"").trim();
    if(!roomNumber||!roomPin){setStatus("Bitte Zimmernummer und PIN eintragen.");return}
    setBusy(true);setStatus("");
    const {error}=await supabase.from("hotel_room_credentials").upsert({user_id:profile.id,hotel_id:hotelId,room_number:roomNumber,room_pin:roomPin,updated_at:new Date().toISOString()},{onConflict:"user_id,hotel_id"});
    setBusy(false);
    if(error){setStatus(error.message);return}
    setRoom({room_number:roomNumber,room_pin:roomPin});
    setStatus("Zimmerdaten gespeichert.");
    window.setTimeout(()=>setOpen(false),500);
  }

  if(!profile?.id)return null;

  const overlay=open&&typeof document!=="undefined"?createPortal(
    <div className="hotel-room-overlay" role="dialog" aria-modal="true" aria-label={`Mein Hotelzimmer in ${hotelName}`}>
      <button className="hotel-room-backdrop" aria-label="Schließen" onClick={()=>!busy&&setOpen(false)}/>
      <form className="hotel-room-modal" onSubmit={save}>
        <button type="button" className="hotel-room-close" aria-label="Schließen" disabled={busy} onClick={()=>setOpen(false)}><X/></button>
        <span className="eyebrow">NUR FÜR DICH</span>
        <h2>Mein Hotelzimmer</h2>
        <p><strong>{hotelName}</strong><br/>Speichere hier deine Zimmernummer und den Zimmer-PIN. Diese Daten gehören nur zu diesem Hotel und sind für andere Teilnehmer nicht sichtbar.</p>
        <label><span>Zimmernummer</span><input name="room_number" defaultValue={room?.room_number||""} placeholder="z. B. 214" autoComplete="off" required/></label>
        <label><span>Zimmer-PIN</span><input name="room_pin" defaultValue={room?.room_pin||""} placeholder="z. B. 4821" inputMode="numeric" autoComplete="off" required/></label>
        {status&&<div className="hotel-room-status">{status}</div>}
        <button className="hotel-room-save" disabled={busy}><Save/>{busy?"Wird gespeichert …":"Zimmerdaten speichern"}</button>
      </form>
    </div>,document.body):null;

  return <>
    <section className="hotel-room-section">
      <button className="hotel-room-launch" onClick={()=>{setStatus("");setOpen(true)}}>
        <span className="hotel-room-icon"><BedDouble/></span>
        <span className="hotel-room-copy">
          <strong>{room?`Zimmer ${room.room_number}`:"Mein Zimmer speichern"}</strong>
          <small>{room?`${hotelName} · Zimmernummer & PIN anzeigen oder ändern`:`${hotelName} · Zimmernummer und PIN nur für dich hinterlegen`}</small>
        </span>
        <span className="hotel-room-edit">{room?<Pencil/>:<KeyRound/>}</span>
      </button>
    </section>
    {overlay}
  </>;
}
