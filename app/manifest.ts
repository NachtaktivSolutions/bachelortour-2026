import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Firestarter 2026",
    short_name: "Firestarter 2026",
    description: "Die gemeinsame App für die Bachelortour 2026",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#090909",
    orientation: "portrait",
    icons: [
      { src: "/api/branding/icon?v=12", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/branding/icon?v=12", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
