"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RotateCcw, Star, Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type ScoreRow={user_id:string;score:number;updated_at:string;profiles:{name:string}|null};
type Props={open:boolean;onClose:()=>void};
type Joint={x:number;y:number;speed:number;size:number;angle:number};
type Shot={x:number;y:number};

const BUS_SIZE=58;
const BUS_WIDTH=BUS_SIZE*1.25;
const BUS_HALF_WIDTH=BUS_WIDTH/2;
const EDGE_PADDING=2;
const LEAF_DRAW_RADIUS=16;
const LEAF_HIT_RADIUS=14;

export function JointInvadersGame({open,onClose}:Props){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
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
  useEffect(()=>{
    if(open){loadScores();document.body.classList.add("joint-game-open")}
    else stopGame();
    return()=>document.body.classList.remove("joint-game-open");
  },[open,loadScores]);
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
    if(now-g.lastSpawn>Math.max(420,950-g.score*5)){
      g.lastSpawn=now;
      const size=34+Math.random()*13;
      const jointHalfWidth=size*1.35/2;
      const minX=jointHalfWidth+EDGE_PADDING;
      const maxX=Math.max(minX,canvas.width-jointHalfWidth-EDGE_PADDING);
      g.joints.push({x:minX+Math.random()*(maxX-minX),y:-40,speed:0.12+Math.random()*.08+g.score*.0008,size,angle:(Math.random()-.5)*.8})
    }
    if(now-g.lastShot>300){g.lastShot=now;g.shots.push({x:g.busX,y:canvas.height-82})}
    g.shots.forEach(s=>s.y-=0.55*dt);g.joints.forEach(j=>j.y+=j.speed*dt);
    g.shots=g.shots.filter(s=>s.y>-30);g.joints=g.joints.filter(j=>{if(j.y>canvas.height+25){g.lives--;setLives(g.lives);return false}return true});
    for(let ji=g.joints.length-1;ji>=0;ji--){
      for(let si=g.shots.length-1;si>=0;si--){
        const j=g.joints[ji],s=g.shots[si];
        const dx=j.x-s.x,dy=j.y-s.y;
        const jointRadius=j.size*.72;
        const hitRadius=jointRadius+LEAF_HIT_RADIUS;
        if(dx*dx+dy*dy<=hitRadius*hitRadius){
          g.joints.splice(ji,1);g.shots.splice(si,1);g.score+=10;setScore(g.score);break
        }
      }
    }
    draw(ctx,canvas,g);
    if(g.lives<=0){finishGame();return}
    frameRef.current=requestAnimationFrame(loop);
  }

  function draw(ctx:CanvasRenderingContext2D,canvas:HTMLCanvasElement,g:typeof gameRef.current){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const grd=ctx.createLinearGradient(0,0,0,canvas.height);grd.addColorStop(0,"#06120b");grd.addColorStop(1,"#020403");ctx.fillStyle=grd;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#4cff853f";for(let i=0;i<42;i++){const x=(i*131+17)%canvas.width,y=(i*197+31)%canvas.height;ctx.beginPath();ctx.arc(x,y,i%4===0?2:1,0,Math.PI*2);ctx.fill()}
    g.joints.forEach(j=>drawJoint(ctx,j));
    g.shots.forEach(s=>drawLeaf(ctx,s.x,s.y,LEAF_DRAW_RADIUS));
    drawBus(ctx,g.busX,canvas.height-46,BUS_SIZE);
  }

  function drawJoint(ctx:CanvasRenderingContext2D,j:Joint){
    ctx.save();ctx.translate(j.x,j.y);ctx.rotate(j.angle);
    const w=j.size*1.35,h=j.size*.28;
    ctx.shadowColor="#ff6b30";ctx.shadowBlur=8;ctx.fillStyle="#f4efe4";roundRect(ctx,-w/2,-h/2,w,h,h/2);ctx.fill();
    ctx.fillStyle="#d9c4a7";ctx.fillRect(w*.15,-h/2,w*.25,h);
    ctx.fillStyle="#ff4b22";ctx.beginPath();ctx.arc(w/2-2,0,h*.42,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle="#a8aaa8";ctx.lineWidth=2;ctx.globalAlpha=.6;
    for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(-w*.2+i*6,-h);ctx.bezierCurveTo(-w*.35+i*8,-h*2,-w*.05+i*8,-h*2.7,-w*.2+i*7,-h*3.5);ctx.stroke()}
    ctx.restore();ctx.globalAlpha=1;
  }

  function drawLeaf(ctx:CanvasRenderingContext2D,x:number,y:number,r:number){
    ctx.save();ctx.translate(x,y);ctx.shadowColor="#37ff78";ctx.shadowBlur=12;ctx.fillStyle="#36e56c";ctx.strokeStyle="#a7ffc0";ctx.lineWidth=1.2;
    for(let i=0;i<7;i++){ctx.save();ctx.rotate((i-3)*.38);ctx.beginPath();ctx.moveTo(0,3);ctx.quadraticCurveTo(-r*.32,-r*.35,0,-r);ctx.quadraticCurveTo(r*.32,-r*.35,0,3);ctx.fill();ctx.stroke();ctx.restore()}
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,r*.75);ctx.stroke();ctx.restore();
  }

  function drawBus(ctx:CanvasRenderingContext2D,x:number,y:number,size:number){
    ctx.save();ctx.translate(x,y);ctx.shadowColor="#ff8a24";ctx.shadowBlur=18;
    const w=size*1.25,h=size*.64;ctx.fillStyle="#ff8a24";roundRect(ctx,-w/2,-h/2,w,h,10);ctx.fill();
    ctx.fillStyle="#f4f0df";roundRect(ctx,-w*.39,-h*.4,w*.78,h*.42,7);ctx.fill();
    ctx.fillStyle="#78c9df";roundRect(ctx,-w*.32,-h*.34,w*.27,h*.27,3);ctx.fill();roundRect(ctx,w*.05,-h*.34,w*.27,h*.27,3);ctx.fill();
    ctx.fillStyle="#f9d45d";ctx.beginPath();ctx.arc(-w*.35,h*.09,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.35,h*.09,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#151515";ctx.beginPath();ctx.arc(-w*.28,h*.36,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.28,h*.36,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#ddd";ctx.beginPath();ctx.arc(-w*.28,h*.36,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.28,h*.36,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}

  async function finishGame(){const finalScore=gameRef.current.score;stopGame();setStatus(`Game Over · ${finalScore} Punkte`);if(profile){await supabase.rpc("save_joint_invaders_score",{new_score:finalScore});await loadScores()}}
  function move(clientX:number){
    const canvas=canvasRef.current;if(!canvas||!gameRef.current.running)return;
    const rect=canvas.getBoundingClientRect();const scale=canvas.width/rect.width;
    const requestedX=(clientX-rect.left)*scale;
    const minX=BUS_HALF_WIDTH+EDGE_PADDING;
    const maxX=Math.max(minX,canvas.width-BUS_HALF_WIDTH-EDGE_PADDING);
    gameRef.current.busX=Math.max(minX,Math.min(maxX,requestedX));
  }

  const ownScore=highscores.find(row=>row.user_id===profile?.id)?.score??0;
  const ownRank=highscores.findIndex(row=>row.user_id===profile?.id)+1;
  if(!open||!mounted)return null;
  return createPortal(<div className="joint-game-backdrop"><section className="joint-game-modal"><button className="joint-game-close" onClick={onClose} aria-label="Spiel schließen"><X/></button><div className="joint-game-title"><span>🌿</span><h2>JOINT INVADERS</h2></div><p className="joint-game-subtitle">Der Bachelor-Bus schießt Hanfblätter auf fallende Joints.</p><div className="joint-game-summary"><div><Star/><span>Dein Bestscore</span><strong>{ownScore}</strong></div><div><Trophy/><span>Dein Rang</span><strong>{ownRank?`${ownRank} / ${highscores.length}`:"–"}</strong></div></div><div className="joint-game-stage"><div className="joint-game-hud"><span>PUNKTE <b>{score}</b></span><span>LEBEN <b>{"♥".repeat(lives)}{"♡".repeat(3-lives)}</b></span></div><canvas ref={canvasRef} className="joint-game-canvas" onPointerMove={e=>move(e.clientX)} onPointerDown={e=>move(e.clientX)}/></div><div className="joint-game-actions"><button className="primary-button" onClick={startGame}>{running?<RotateCcw/>:<Play/>} {running?"Neu starten":"Spiel starten"}</button><small>Bus mit dem Finger bewegen · Schüsse laufen automatisch</small></div>{status&&<div className="joint-game-status">{status}</div>}<div className="joint-leaderboard"><h3><Trophy/> TOP 5 HIGHSCORES</h3>{Array.from({length:5},(_,index)=>highscores[index]).map((row,index)=><div key={row?.user_id??`empty-${index}`} className={row?.user_id===profile?.id?"is-own":""}><b>{index+1}.</b><span>{row?.profiles?.name||"---"}</span><strong>{row?.score??"---"}</strong></div>)}</div></section></div>,document.body);
}
