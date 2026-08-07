"use client";

import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useApp } from "./app-provider";
import { AdminTourBurnCard } from "./admin-tour-burn-card";

export function AdminTourBurnPortal(){
  const pathname=usePathname();
  const {actualIsAdmin,adminPreview}=useApp();
  const [target,setTarget]=useState<Element|null>(null);
  useEffect(()=>{
    if(pathname!=="/admin"||!actualIsAdmin||adminPreview){setTarget(null);return}
    let frame=0;
    const find=()=>{const node=document.querySelector(".admin-grid");if(node){setTarget(node);return}frame=requestAnimationFrame(find)};
    find();return()=>cancelAnimationFrame(frame);
  },[pathname,actualIsAdmin,adminPreview]);
  if(!target)return null;
  return createPortal(<AdminTourBurnCard/>,target);
}
