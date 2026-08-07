"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Map, MessageCircle, Images, Users, Shield, LogOut, CalendarCog, MapPinned, Luggage, ListChecks, LayoutDashboard, ChevronDown, LifeBuoy, BellRing, Volume2, Eye, EyeOff, Smartphone, Sparkles, Newspaper, Beer } from "lucide-react";
import { useApp } from "./app-provider";
import { createClient } from "@/lib/supabase/client";
import { PwaInstallPrompt } from "./pwa-install-prompt";
import { EasterEgg } from "./easter-egg";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Karte", icon: Map },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/bachelorando", label: "Bachelorando", icon: Beer },
  { href: "/ai-guide", label: "KI-Guide", icon: Sparkles },
  { href: "/gallery", label: "Fotos", icon: Images },
  { href: "/members", label: "Bachelor", icon: Users }
];

const adminLinks = [
  { href: "/admin", label: "Admin-Zentrale", description: "Push, Tour und Mitglieder", icon: LayoutDashboard },
  { href: "/admin/news", label: "Neuigkeiten verwalten", description: "Vorbereiten, bearbeiten und gezielt veröffentlichen", icon: Newspaper },
  { href: "/admin/devices", label: "Geräteübersicht", description: "Installation, Push, Standort und Online-Status", icon: Smartphone },
  { href: "/admin/reminders", label: "Erinnerungen", description: "Automatische Pushs planen und verwalten", icon: BellRing },
  { href: "/admin/events", label: "Programm verwalten", description: "Programmpunkte anlegen und bearbeiten", icon: CalendarCog },
  { href: "/admin/places", label: "Hotels & Wissenswertes", description: "Geheime Orte und Unterkunft steuern", icon: MapPinned },
  { href: "/admin/packing-list", label: "Packliste verwalten", description: "Rubriken, Gegenstände und Freigabe", icon: ListChecks },
  { href: "/admin/sounds", label: "Tour-Medien", description: "Sounds und Videos hochladen und freischalten", icon: Volume2 },
  { href: "/admin/tour-tools", label: "Notfall & Check-ins", description: "Notfallkontakte und Anwesenheit", icon: LifeBuoy }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile,actualIsAdmin,adminPreview,setAdminPreview } = useApp();
  const [unreadChat, setUnreadChat] = useState(0);
  const [packingVisible,setPackingVisible]=useState(false);
  const [adminMenuOpen,setAdminMenuOpen]=useState(false);
  const [easterOpen,setEasterOpen]=useState(false);
  const [easterAudio,setEasterAudio]=useState<HTMLAudioElement|null>(null);
  const easterTaps=useRef<number[]>([]);
  const adminMenuRef=useRef<HTMLDivElement>(null);
  const supabase = useMemo(()=>createClient(),[]);
  const navItems=nav;

  const loadUnread = useCallback(async () => {
    if (!profile) return;
    if (pathname.startsWith("/chat")) { setUnreadChat(0); return; }
    const since = profile.chat_last_read_at || "1970-01-01T00:00:00.000Z";
    const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).neq("sender_id", profile.id).gt("created_at", since);
    setUnreadChat(count || 0);
  }, [pathname, profile?.id, profile?.chat_last_read_at, supabase]);

  const loadPacking=useCallback(async()=>{const {data}=await supabase.from("packing_settings").select("is_visible").eq("id",1).maybeSingle();setPackingVisible(Boolean(data?.is_visible))},[supabase]);

  useEffect(() => {
    loadUnread();loadPacking();
    const channel = supabase.channel(`shell-live-${profile?.id||"guest"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, loadUnread)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile?.id}` }, loadUnread)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "packing_settings", filter:"id=eq.1" }, loadPacking)
      .subscribe();
    const onRead = () => { setUnreadChat(0); loadUnread(); };
    window.addEventListener("chat-read", onRead);
    return () => { window.removeEventListener("chat-read", onRead); supabase.removeChannel(channel); };
  }, [loadUnread,loadPacking,profile?.id,supabase]);

  useEffect(()=>{setAdminMenuOpen(false)},[pathname]);
  useEffect(()=>{
    if(!adminMenuOpen)return;
    const close=(event:MouseEvent)=>{if(adminMenuRef.current&&!adminMenuRef.current.contains(event.target as Node))setAdminMenuOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setAdminMenuOpen(false)};
    document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape)};
  },[adminMenuOpen]);

  const logout = async () => { setAdminPreview(false);await supabase.auth.signOut(); router.replace("/login"); };
  const closeEaster=useCallback(()=>{setEasterOpen(false);setEasterAudio(null)},[]);
  const triggerEaster=(event:React.MouseEvent<HTMLAnchorElement>)=>{
    const now=Date.now();
    easterTaps.current=[...easterTaps.current.filter(time=>now-time<1900),now];
    if(easterTaps.current.length>=5){
      event.preventDefault();
      easterTaps.current=[];
      const audio=new Audio("/easter-egg.mp3");
      audio.preload="auto";
      audio.volume=.95;
      audio.currentTime=0;
      setEasterAudio(audio);
      void audio.play().catch(()=>{});
      setEasterOpen(true);
    }
  };
  const enterParticipantView=()=>{setAdminMenuOpen(false);setAdminPreview(true);if(pathname.startsWith("/admin"))router.push("/")};
  const leaveParticipantView=()=>setAdminPreview(false);

  return <div className={`app-shell${adminPreview?" participant-preview-active":""}`}>
    <header className="topbar">
      <Link href="/" className="brand-lockup" onClick={triggerEaster}><img className="brand-tour-icon" src="/api/branding/icon" alt="Firestarter"/><div><span className="eyebrow">FIRESTARTER 26</span><strong>Bachelortour 2026</strong></div></Link>
      <div className="top-actions">
        <Link className="icon-button" href="/tour-tools" aria-label="Hilfe und Check-in" title="Hilfe, Check-in und Status"><LifeBuoy size={20}/></Link>
        {(packingVisible||profile?.is_admin)&&<Link className="icon-button" href="/packing-list" aria-label="Packliste" title="Packliste"><Luggage size={20}/></Link>}
        {actualIsAdmin&&adminPreview&&<button type="button" className="icon-button participant-preview-exit-icon" onClick={leaveParticipantView} aria-label="Teilnehmeransicht verlassen" title="Adminansicht wiederherstellen"><EyeOff size={20}/></button>}
        {actualIsAdmin&&!adminPreview&&<div className="admin-menu-wrap" ref={adminMenuRef}>
          <button type="button" className={`icon-button admin-button admin-menu-trigger ${adminMenuOpen?"active":""}`} onClick={()=>setAdminMenuOpen(value=>!value)} aria-label="Admin-Menü" aria-expanded={adminMenuOpen} title="Admin-Menü"><Shield size={20}/><ChevronDown className="admin-menu-chevron" size={12}/></button>
          {adminMenuOpen&&<div className="admin-dropdown" role="menu"><div className="admin-dropdown-head"><span className="eyebrow">KOMMANDOZENTRALE</span><strong>Admin-Menü</strong></div><button type="button" className="admin-preview-menu-item" onClick={enterParticipantView} role="menuitem"><span className="admin-dropdown-icon"><Eye size={20}/></span><span><strong>Als Teilnehmer ansehen</strong><small>Die gesamte App ohne Adminfunktionen prüfen</small></span></button>{adminLinks.map(({href,label,description,icon:Icon})=><Link key={href} href={href} className={pathname===href?"active":""} role="menuitem"><span className="admin-dropdown-icon"><Icon size={20}/></span><span><strong>{label}</strong><small>{description}</small></span></Link>)}</div>}
        </div>}
        <button className="icon-button logout-button" onClick={logout} aria-label="Abmelden"><LogOut size={19}/></button>
        <Link href="/profile" className="avatar" aria-label="Mein Profil" title="Mein Profil">{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:<span>{profile?.name?.slice(0,1)??"?"}</span>}</Link>
      </div>
    </header>
    {adminPreview&&<div className="participant-preview-banner" role="status"><span><Eye size={17}/><strong>Teilnehmeransicht aktiv</strong><small>Du siehst die App jetzt wie ein normales Mitglied.</small></span><button type="button" onClick={leaveParticipantView}>Adminmodus</button></div>}
    <main className="page-content">{children}</main>
    <nav className="bottom-nav" style={{gridTemplateColumns:`repeat(${navItems.length},1fr)`}}>{navItems.map(({href,label,icon:Icon})=>{const active=href==="/"?pathname==="/":pathname.startsWith(href);const isChat=href==="/chat";return <Link key={href} href={href} className={active?"active":""}><span className="nav-icon-wrap"><Icon size={22}/>{isChat&&unreadChat>0&&<span className="chat-unread-badge">{unreadChat>99?"99+":unreadChat}</span>}</span><span>{label}</span></Link>})}</nav>
    <PwaInstallPrompt/>
    <EasterEgg open={easterOpen} audio={easterAudio} onClose={closeEaster}/>
  </div>;
}
