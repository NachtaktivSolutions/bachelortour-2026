"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Home, Map, MessageCircle, Images, Users, Shield, LogOut, CalendarCog } from "lucide-react";
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
  const [unreadChat, setUnreadChat] = useState(0);
  const supabase = createClient();

  const loadUnread = useCallback(async () => {
    if (!profile) return;
    if (pathname.startsWith("/chat")) {
      setUnreadChat(0);
      return;
    }
    const since = profile.chat_last_read_at || "1970-01-01T00:00:00.000Z";
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", profile.id)
      .gt("created_at", since);
    setUnreadChat(count || 0);
  }, [pathname, profile, supabase]);

  useEffect(() => {
    loadUnread();
    const channel = supabase.channel("chat-unread-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, loadUnread)
      .subscribe();
    const onRead = () => setUnreadChat(0);
    window.addEventListener("chat-read", onRead);
    return () => {
      window.removeEventListener("chat-read", onRead);
      supabase.removeChannel(channel);
    };
  }, [loadUnread, supabase]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand-lockup">
          <img className="brand-tour-icon" src="/brand/firestarter-hero.jpg" alt="Firestarter" />
          <div><span className="eyebrow">FIRESTARTER 26</span><strong>Bachelortour 2026</strong></div>
        </Link>
        <div className="top-actions">
          {profile?.is_admin && <>
            <Link className="icon-button admin-button" href="/admin/events" aria-label="Events verwalten" title="Events verwalten"><CalendarCog size={20} /></Link>
            <Link className="icon-button admin-button" href="/admin" aria-label="Adminbereich" title="Adminbereich"><Shield size={20} /></Link>
          </>}
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
          const isChat = href === "/chat";
          return <Link key={href} href={href} className={active ? "active" : ""}>
            <span className="nav-icon-wrap"><Icon size={22}/>{isChat && unreadChat > 0 && <span className="chat-unread-badge">{unreadChat > 99 ? "99+" : unreadChat}</span>}</span>
            <span>{label}</span>
          </Link>;
        })}
      </nav>
    </div>
  );
}
