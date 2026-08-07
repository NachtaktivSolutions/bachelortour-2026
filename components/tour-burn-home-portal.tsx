"use client";

import { useEffect,useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { TourBurnControl } from "./tour-burn-control";

export function TourBurnHomePortal(){
  const pathname=usePathname();const[mount,setMount]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    if(pathname!=="/"){setMount(null);return}
    let host:HTMLElement|null=null;
    const attach=()=>{const hero=document.querySelector("section.hero.premium-hero");if(!hero)return false;host=document.createElement("div");host.className="tour-burn-home-mount";hero.insertAdjacentElement("afterend",host);setMount(host);return true};
    if(!attach()){const observer=new MutationObserver(()=>{if(attach())observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});const timer=window.setTimeout(()=>observer.disconnect(),5000);return()=>{window.clearTimeout(timer);observer.disconnect();host?.remove()}}
    return()=>{host?.remove();setMount(null)};
  },[pathname]);
  return mount?createPortal(<TourBurnControl/>,mount):null;
}
