import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?firestarter=2026-v49",
    name: "Firestarter 2026",
    short_name: "Firestarter 2026",
    description: "Die gemeinsame App für die Bachelortour 2026",
    start_url: "/?source=pwa-v49",
    scope: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#090909",
    orientation: "portrait",
    icons: [
      { src: "/api/branding/icon?v=49", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/branding/icon?v=49", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
