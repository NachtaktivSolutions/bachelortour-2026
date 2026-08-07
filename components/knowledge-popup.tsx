"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Info, Navigation, Phone, X, ChevronRight } from "lucide-react";
import "./knowledge-popup.css";

type KnowledgeItem={
  id:string;
  category:string;
  title:string;
  description:string|null;
  address:string|null;
  phone:string|null;
  url:string|null;
};

export function KnowledgePopup({items}:{items:KnowledgeItem[]}){
  const [open,setOpen]=useState(false);
  const [activeId,setActiveId]=useState<string|null>(null);
  const categories=useMemo(()=>Array.from(new Set(items.map(i=>i.category).filter(Boolean))),[items]);

  useEffect(()=>{
    const openFromHash=()=>{
      const hash=window.location.hash;
      if(!hash.startsWith("#knowledge-"))return;
      const id=hash.replace("#knowledge-","");
      if(items.some(i=>i.id===id)){
        setOpen(true);
        setActiveId(id);
        window.setTimeout(()=>document.getElementById(`knowledge-popup-${id}`)?.scrollIntoView({behavior:"smooth",block:"center"}),180);
      }
    };
    openFromHash();
    window.addEventListener("hashchange",openFromHash);
    return()=>window.removeEventListener("hashchange",openFromHash);
  },[items]);

  useEffect(()=>{
    if(!open)return;
    const old=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=old};
  },[open]);

  if(!items.length)return null;

  return <>
    <section className="section knowledge-launch-section" id="knowledge">
      <button className="knowledge-launch-card" onClick={()=>setOpen(true)}>
        <span className="knowledge-launch-icon"><Info size={22}/></span>
        <span className="knowledge-launch-copy">
          <strong>Wissenswertes</strong>
          <small>{items.length} freigeschaltete {items.length===1?"Empfehlung":"Empfehlungen"}{categories.length?` · ${categories.slice(0,3).join(" · ")}`:""}</small>
        </span>
        <span className="knowledge-launch-more">Ansehen <ChevronRight size={18}/></span>
      </button>
    </section>

    {open&&<div className="knowledge-overlay" role="dialog" aria-modal="true" aria-label="Wissenswertes">
      <button className="knowledge-overlay-backdrop" aria-label="Schließen" onClick={()=>setOpen(false)}/>
      <div className="knowledge-sheet">
        <div className="knowledge-sheet-handle"/>
        <header className="knowledge-sheet-header">
          <div><span className="eyebrow">FIRESTARTER TIPPS</span><h2>Wissenswertes</h2><p>{items.length} freigeschaltete Tipps für die Tour.</p></div>
          <button className="knowledge-close" onClick={()=>setOpen(false)} aria-label="Schließen"><X/></button>
        </header>
        <div className="knowledge-popup-list">
          {items.map(item=><article className={`knowledge-popup-card ${activeId===item.id?"is-target":""}`} id={`knowledge-popup-${item.id}`} key={item.id}>
            <div className="knowledge-popup-top"><span className="eyebrow">{item.category.toUpperCase()}</span></div>
            <h3>{item.title}</h3>
            {item.description&&<p>{item.description}</p>}
            {item.address&&<small>{item.address}</small>}
            <div className="knowledge-popup-actions">
              {item.phone&&<a className="knowledge-action" href={`tel:${item.phone}`}><Phone size={19}/><span>Anrufen</span></a>}
              {item.address&&<a className="knowledge-action primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}><Navigation size={19}/><span>Route</span></a>}
              {item.url&&<a className="knowledge-action" target="_blank" rel="noreferrer" href={item.url}><ExternalLink size={19}/><span>Website</span></a>}
            </div>
          </article>)}
        </div>
      </div>
    </div>}
  </>;
}
