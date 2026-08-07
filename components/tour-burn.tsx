"use client";

import { useEffect, useState } from "react";
import styles from "./tour-burn.module.css";

type Props = { mode: "animation" | "final"; onFinished?: () => void; preview?: boolean };

export function TourBurn({ mode, onFinished, preview=false }: Props) {
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    if(mode!=="animation")return;
    setPhase(0);
    const timers=[
      window.setTimeout(()=>setPhase(1),500),
      window.setTimeout(()=>setPhase(2),1600),
      window.setTimeout(()=>setPhase(3),2900),
      window.setTimeout(()=>{setPhase(4);onFinished?.()},4300)
    ];
    return()=>timers.forEach(window.clearTimeout);
  },[mode,onFinished]);

  if(mode==="final") return <div className={styles.finalScreen}>
    <div className={styles.embers}/><div className={styles.finalContent}>
      <div className={styles.logoRing}>🔥</div>
      <span className={styles.kicker}>FIRESTARTER 26</span>
      <h1>Das war Firestarter 2026.</h1>
      <p>Was auf Tour passiert, bleibt auf Tour!</p>
      <p>Das Einzige, was wir sagen, wie es war?! <strong>– Nett!</strong></p>
      <div className={styles.divider}/>
      <h2>Die nächste Tour wird kommen.</h2>
      <small>Bis dahin: Erinnerungen behalten. Beweise vernichten. 🔥</small>
      {preview&&<span className={styles.previewBadge}>VORSCHAU – nichts wurde wirklich verbrannt</span>}
    </div>
  </div>;

  return <div className={`${styles.overlay} ${styles[`phase${phase}`]}`} aria-live="assertive">
    <div className={styles.flash}/>
    <div className={styles.smoke}/>
    <div className={styles.fireBase}/>
    <div className={styles.flames}>{Array.from({length:22}).map((_,i)=><span key={i} style={{left:`${(i*47)%101}%`,animationDelay:`-${(i%7)*.19}s`,animationDuration:`${1.15+(i%5)*.17}s`}}>🔥</span>)}</div>
    <div className={styles.burnCopy}>
      <span>FIRESTARTER 26</span>
      <h1>{phase<2?"Diese Tour wird verbrannt …":"Was auf Tour passiert …"}</h1>
      {phase>=2&&<p>… bleibt auf Tour.</p>}
    </div>
  </div>;
}
