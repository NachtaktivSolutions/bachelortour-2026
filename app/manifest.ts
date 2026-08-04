import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bachelortour 2026 – Firestarter",
    short_name: "Firestarter",
    description: "Die gemeinsame App für die Bachelortour 2026",
    start_url: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#ff6a00",
    orientation: "portrait",
    icons: [
      { src: "/api/branding/icon", sizes: "192x192", type: "image/jpeg", purpose: "any maskable" },
      { src: "/api/branding/icon", sizes: "512x512", type: "image/jpeg", purpose: "any maskable" }
    ]
  };
}
