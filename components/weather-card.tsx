"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, CloudRain, CloudSun, Sun, Snowflake, X } from "lucide-react";

type WeatherData = {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
};

function icon(code: number) {
  if (code === 0) return <Sun />;
  if ([1,2,3].includes(code)) return <CloudSun />;
  if ([45,48].includes(code)) return <Cloud />;
  if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(code)) return <CloudRain />;
  if ([71,73,75,77,85,86].includes(code)) return <Snowflake />;
  return <Cloud />;
}

function label(code: number) {
  if (code === 0) return "Klar";
  if ([1,2].includes(code)) return "Leicht bewölkt";
  if (code === 3) return "Bewölkt";
  if ([45,48].includes(code)) return "Nebel";
  if ([51,53,55].includes(code)) return "Nieselregen";
  if ([61,63,65,80,81,82].includes(code)) return "Regen";
  if ([71,73,75,77,85,86].includes(code)) return "Schnee";
  if ([95,96,99].includes(code)) return "Gewitter";
  return "Wetter";
}

export function WeatherCard({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);
  const [easterOpen, setEasterOpen] = useState(false);
  const taps = useRef(0);
  const tapTimer = useRef<number | null>(null);

  useEffect(() => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m");
    url.searchParams.set("timezone", "Europe/Berlin");
    fetch(url)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(json => setData(json.current))
      .catch(() => setFailed(true));
  }, [latitude, longitude]);

  useEffect(() => {
    if (!easterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [easterOpen]);

  useEffect(() => () => {
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
  }, []);

  function tapWeather() {
    taps.current += 1;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    if (taps.current >= 5) {
      taps.current = 0;
      setEasterOpen(true);
      return;
    }
    tapTimer.current = window.setTimeout(() => { taps.current = 0; }, 1200);
  }

  if (failed) return null;

  return (
    <>
      <article className="weather-card weather-card-premium" onClick={tapWeather} style={{cursor:"pointer",userSelect:"none"}}>
        <div className="weather-icon">{data ? icon(data.weather_code) : <CloudSun />}</div>
        <div className="weather-main">
          <span className="eyebrow">AKTUELLES WETTER</span>
          <h3>{data ? `${Math.round(data.temperature_2m)} °C` : "Lädt …"}</h3>
          <p>{data ? label(data.weather_code) : "Wetter wird geladen"}</p>
          {data&&<small>Gefühlt {Math.round(data.apparent_temperature)} °C</small>}
        </div>
      </article>

      {easterOpen&&<div role="dialog" aria-modal="true" aria-label="Wetter Easter Egg" style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",background:"rgba(0,0,0,.86)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
        <div style={{position:"relative",width:"min(92vw,760px)",maxHeight:"88dvh",borderRadius:"28px",overflow:"hidden",border:"1px solid rgba(255,255,255,.14)",boxShadow:"0 24px 90px rgba(0,0,0,.72)",background:"#111"}}>
          <img src="/weather-easter-egg.svg" alt="Bus an einer roten Ampel auf einer weiten Wiese mit Hasen" style={{display:"block",width:"100%",maxHeight:"88dvh",objectFit:"cover"}}/>
          <button type="button" aria-label="Easter Egg schließen" onClick={()=>setEasterOpen(false)} style={{position:"absolute",top:"14px",right:"14px",width:"48px",height:"48px",display:"grid",placeItems:"center",borderRadius:"999px",border:"1px solid rgba(255,255,255,.16)",background:"rgba(8,8,8,.88)",color:"white",boxShadow:"0 8px 26px rgba(0,0,0,.4)",cursor:"pointer"}}><X size={28}/></button>
        </div>
      </div>}
    </>
  );
}
