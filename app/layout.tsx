import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./push-settings.css";
import "./v8.css";
import "./v9-branding.css";
import "./v10-premium.css";
import "./v11-admin.css";
import "./v12-mobile-fixes.css";
import "./v14-secret-places.css";
import "./v15-mobile-gallery.css";
import "./v16-chat-spotify.css";
import "./v17-icons-chat.css";
import "./v18-admin-clarity.css";
import "leaflet/dist/leaflet.css";
import { AppProvider } from "@/components/app-provider";

export const metadata: Metadata = {
  title: "Firestarter 2026",
  applicationName: "Firestarter 2026",
  description: "News, Chat, Fotos, Karte und Live-Standorte für die Bachelortour 2026",
  manifest: "/manifest.webmanifest?v=18",
  appleWebApp: { capable: true, statusBarStyle: "black", title: "Firestarter 2026" },
  icons: { icon: "/api/branding/icon?v=18", apple: "/api/branding/icon?v=18" }
};

export const viewport: Viewport = { themeColor: "#090909", width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body><AppProvider>{children}</AppProvider></body></html>;
}
