"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Map, MessageCircle, Images, Users, Shield, LogOut } from "lucide-react";
import { useApp } from "./app-provider";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Karte", icon: Map },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/gallery", label: "Fotos", icon: Images },
  { href: "/members", label: "Bachelor", icon: Users }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useApp();

  const logout = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand-lockup">
          <span className="brand-flame">🔥</span>
          <div><span className="eyebrow">FIRESTARTER 26</span><strong>Bachelortour 2026</strong></div>
        </Link>
        <div className="top-actions">
          {profile?.is_admin && (
            <Link className="icon-button admin-button" href="/admin" aria-label="Adminbereich"><Shield size={20} /></Link>
          )}
          <button className="icon-button logout-button" onClick={logout} aria-label="Abmelden"><LogOut size={19} /></button>
          <Link href="/profile" className="avatar" aria-label="Mein Profil" title="Mein Profil">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile?.name?.slice(0,1) ?? "?"}</span>}
          </Link>
        </div>
      </header>
      <main className="page-content">{children}</main>
      <nav className="bottom-nav">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "active" : ""}><Icon size={22}/><span>{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
