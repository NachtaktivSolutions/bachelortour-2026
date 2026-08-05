"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type ScoreRow={user_id:string;score:number;updated_at:string;profiles:{name:string}|null};
type Props={open:boolean;onClose:()=>void};
type Joint={x:number;y:number;speed:number;size:number};
type Shot={x:number;y:number};

export function JointInvadersGame({open,onClose}:Props){
  const {profile}=useApp();
  const supabase=createClient();
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const frameRef=useRef<number|null>(null);
  const gameRef=useRef({running:false,busX:0,joints:[] as Joint[],shots:[] as Shot[],score:0,lives:3,lastSpawn:0,lastShot:0,lastTime:0});
  const [mounted,setMounted]=useState(false);
  const [running,setRunning]=useState(false);
  const [score,setScore]=useState(0);
  const [lives,setLives]=useState(3);
  const [highscores,setHighscores]=useState<ScoreRow[]>([]);
  const [status,setStatus]=useState("");

  const loadScores=useCallback(async()=>{
    const {data}=await supabase.from("joint_invaders_scores").select("user_id,score,updated_at,profiles(name)").order("score",{ascending:false}).order("updated_at",{ascending:true}).limit(5);
    setHighscores((data as unknown as ScoreRow[])??[]);
  },[supabase]);

  useEffect(()=>{setMounted(true)},[]);
  useEffect(()=>{if(open)loadScores();else stopGame()},[open,loadScores]);
  useEffect(()=>()=>stopGame(),[]);

  function stopGame(){gameRef.current.running=false;if(frameRef.current)cancelAnimationFrame(frameRef.current);frameRef.current=null;setRunning(false)}

  function startGame(){
    const canvas=canvasRef.current;if(!canvas)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect();
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    const g=gameRef.current;g.running=true;g.busX=canvas.width/2;g.joints=[];g.shots=[];g.score=0;g.lives=3;g.lastSpawn=0;g.lastShot=0;g.lastTime=performance.now();
    setScore(0);setLives(3);setStatus("");setRunning(true);
    frameRef.current=requestAnimationFrame(loop);
  }

  function loop(now:number){
    const canvas=canvasRef.current;const g=gameRef.current;if(!canvas||!g.running)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const dt=Math.min(32,now-g.lastTime);g.lastTime=now;
    if(now-g.lastSpawn>Math.max(420,950-g.score*5)){g.lastSpawn=now;g.joints.push({x:25+Math.random()*(canvas.width-50),y:-30,speed:0.12+Math.random()*.08+g.score*.0008,size:30+Math.random()*12})}
    if(now-g.lastShot>300){g.lastShot=now;g.shots.push({x:g.busX,y:canvas.height-72})}
    g.shots.forEach(s=>s.y-=0.55*dt);g.joints.forEach(j=>j.y+=j.speed*dt);
    g.shots=g.shots.filter(s=>s.y>-30);g.joints=g.joints.filter(j=>{
      if(j.y>canvas.height+20){g.lives--;setLives(g.lives);return false}
      return true;
    });
    for(let ji=g.joints.length-1;ji>=0;ji--){for(let si=g.shots.length-1;si>=0;si--){const j=g.joints[ji],s=g.shots[si];if(Math.abs(j.x-s.x)<j.size*.48&&Math.abs(j.y-s.y)<j.size*.55){g.joints.splice(ji,1);g.shots.splice(si,1);g.score+=10;setScore(g.score);break}}}
    draw(ctx,canvas,g);
    if(g.lives<=0){finishGame();return}
    frameRef.current=requestAnimationFrame(loop);
  }

  function draw(ctx:CanvasRenderingContext2D,canvas:HTMLCanvasElement,g:typeof gameRef.current){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const grd=ctx.createLinearGradient(0,0,0,canvas.height);grd.addColorStop(0,"#07120b");grd.addColorStop(1,"#050505");ctx.fillStyle=grd;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha=.35;ctx.fillStyle="#32ff7a";for(let i=0;i<32;i++){const x=(i*97)%canvas.width,y=(i*173)%canvas.height;ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;
    ctx.textAlign="center";ctx.textBaseline="middle";
    g.joints.forEach(j=>{ctx.font=`${j.size}px system-ui`;ctx.fillText("🚬",j.x,j.y)});
    g.shots.forEach(s=>{ctx.font="24px system-ui";ctx.fillText("🍃",s.x,s.y)});
    ctx.font="54px system-ui";ctx.fillText("🚌",g.busX,canvas.height-38);
  }

  async function finishGame(){
    const finalScore=gameRef.current.score;stopGame();setStatus(`Game Over · ${finalScore} Punkte`);
    if(profile){await supabase.rpc("save_joint_invaders_score",{new_score:finalScore});await loadScores()}
  }

  function move(clientX:number){const canvas=canvasRef.current;if(!canvas||!gameRef.current.running)return;const rect=canvas.getBoundingClientRect();const dpr=canvas.width/rect.width;gameRef.current.busX=Math.max(32*dpr,Math.min(canvas.width-32*dpr,(clientX-rect.left)*dpr))}

  if(!open||!mounted)return null;
  return createPortal(<div className="joint-game-backdrop"><section className="joint-game-modal"><button className="joint-game-close" onClick={onClose}><X/></button><div className="joint-game-head"><div><span className="eyebrow">GEHEIMLEVEL</span><h2>Joint Invaders</h2><p>Der Bachelor-Bus schießt Hanfblätter auf fallende Joints.</p></div><div className="joint-game-stats"><strong>{score}</strong><span>{"❤️".repeat(lives)}</span></div></div><canvas ref={canvasRef} className="joint-game-canvas" onPointerMove={e=>move(e.clientX)} onPointerDown={e=>move(e.clientX)}/><div className="joint-game-actions"><button className="primary-button" onClick={startGame}><RotateCcw/> {running?"Neu starten":"Spiel starten"}</button><small>Bus mit dem Finger bewegen · Schüsse laufen automatisch</small></div>{status&&<div className="joint-game-status">{status}</div>}<div className="joint-leaderboard"><h3><Trophy/> Top 5</h3>{highscores.length?highscores.map((row,index)=><div key={row.user_id} className={row.user_id===profile?.id?"is-own":""}><b>{index+1}.</b><span>{row.profiles?.name||"Bachelor"}</span><strong>{row.score}</strong></div>):<p>Noch keine Highscores.</p>}</div></section></div>,document.body);
}
