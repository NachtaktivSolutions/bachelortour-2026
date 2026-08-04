import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./push-settings.css";
import "./v8.css";
import "./v9-branding.css";
import "./v10-premium.css";
import "leaflet/dist/leaflet.css";
import { AppProvider } from "@/components/app-provider";

export const metadata: Metadata = {
  title: "Bachelortour 2026",
  description: "News, Chat, Fotos, Karte und Live-Standorte für die Bachelortour 2026",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Bachelortour"
  },
  icons: {
    icon: "/api/branding/icon",
    apple: "/api/branding/icon"
  }
};

export const viewport: Viewport = {
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
