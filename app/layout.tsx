import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AppProvider } from "@/components/app-provider";

export const metadata: Metadata = {
  title: "Bachelortour 2026",
  description: "News, Chat, Fotos, Karte und Live-Standorte für die Bachelortour 2026",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bachelortour"
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#ff6a00",
  width: "device-width",
  initialScale: 1,
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
