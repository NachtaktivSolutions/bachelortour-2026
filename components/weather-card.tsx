"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSun, Droplets, Sun, Snowflake, Wind } from "lucide-react";

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

  if (failed) return null;

  return (
    <article className="weather-card weather-card-premium">
      <div className="weather-icon">{data ? icon(data.weather_code) : <CloudSun />}</div>
      <div className="weather-main">
        <span className="eyebrow">AKTUELLES WETTER</span>
        <h3>{data ? `${Math.round(data.temperature_2m)} °C` : "Lädt …"}</h3>
        <p>{data ? `${label(data.weather_code)} · gefühlt ${Math.round(data.apparent_temperature)} °C` : "Filderstadt-Sielmingen"}</p>
      </div>
      {data && <div className="weather-details">
        <span><Wind size={16}/>{Math.round(data.wind_speed_10m)} km/h</span>
        <span><Droplets size={16}/>{Math.round(data.relative_humidity_2m)} %</span>
      </div>}
    </article>
  );
}
