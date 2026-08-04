import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bachelortour 2026",
    short_name: "Bachelortour",
    description: "Die gemeinsame App für die Bachelortour 2026",
    start_url: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#ff6a00",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
