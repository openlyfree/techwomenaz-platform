"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronRight, FileText, HeartHandshake, House, LayoutDashboard, Mail, Menu, Settings, Sparkles, Upload, UserRound, UsersRound, X } from "lucide-react";
import { useSession } from "@/lib/api";
import { Button, ErrorNotice, Loading } from "./ui";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" aria-label="TechWomenAZ home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>TechWomen<span className="brand-az">AZ</span>{!compact && <small>A COMMUNITY OF POSSIBILITY</small>}</span></Link>;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/portal")) return null;
  return <><div className="prototype-bar">Independent hackathon preview · Fictional member data · Not the official site</div><header className="site-header"><div className="container nav-inner"><Brand /><nav className="desktop-nav" aria-label="Main navigation"><Link href="/about">Our community</Link><Link href="/mentorship">Mentorship</Link><Link href="/events">Events</Link></nav><div className="desktop-nav"><Link href="/login" className="nav-login">Sign in</Link><Button href="/join" size="sm">Find your people <ArrowUpRight size={16} /></Button></div><button className="mobile-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button></div>{open && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation" onClick={() => setOpen(false)}><Link href="/about">Our community</Link><Link href="/mentorship">Mentorship</Link><Link href="/events">Events</Link><Link href="/login">Sign in</Link><Button href="/join">Become a member</Button></nav>}</header></>;
}

export function SiteFooter() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/portal")) return null;
  return <footer className="site-footer"><div className="container"><div className="footer-main"><div><Brand /><p>Local roots. Limitless possibilities.<br />Supporting women across Arizona’s tech community.</p></div><nav aria-label="Footer navigation"><Link href="/about">Our community</Link><Link href="/mentorship">Find a mentor</Link><Link href="/events">Events</Link><Link href="/contact">Get in touch</Link></nav><div><p className="eyebrow">MAKE A DIFFERENCE</p><a href="https://givebutter.com/VStKv8" className="footer-donate" target="_blank" rel="noopener noreferrer">Support the community <ArrowUpRight size={17} /></a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} TechWomenAZ community prototype.</span><span>Phoenix · Scottsdale · East Valley</span></div></div></footer>;
}

const staffLinks = [
  ["/admin", "Overview", LayoutDashboard], ["/admin/members", "Our members", UsersRound],
  ["/admin/mentorship", "Mentorship", HeartHandshake], ["/admin/content", "Website editor", Sparkles],
  ["/admin/events", "Events", CalendarDays], ["/admin/mailing", "Newsletter drafts", Mail],
  ["/admin/imports", "Import members", Upload], ["/admin/reports", "Community insights", ChartNoAxesCombined],
  ["/admin/settings", "Settings", Settings],
] as const;
const memberLinks = [
  ["/portal", "My community", House], ["/portal/discover", "Discover connections", HeartHandshake],
  ["/portal/profile", "My profile & availability", UserRound], ["/portal/mentorship", "My mentorships", UsersRound],
  ["/portal/preferences", "My preferences", Settings],
] as const;

export function WorkspaceShell({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const { user, loading, error } = useSession();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const links = staff ? staffLinks : memberLinks;
  const allowed = !!user && (!staff || ["admin", "coordinator", "editor"].includes(user.role));
  return <div className="workspace"><aside className={`workspace-sidebar ${open ? "is-open" : ""}`}><div className="sidebar-top"><Brand compact /><button className="mobile-menu-button" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button></div><div className="workspace-label">{staff ? "YOUR COMMUNITY WORKSPACE" : "A LITTLE SUPPORT GOES A LONG WAY"}</div><nav aria-label={staff ? "Staff navigation" : "Member navigation"}>{links.map(([href, text, Icon]) => <Link href={href} key={href} onClick={() => setOpen(false)} className={`sidebar-link ${path === href || (href !== "/admin" && href !== "/portal" && path.startsWith(href + "/")) ? "active" : ""}`}><Icon size={19} /><span>{text}</span></Link>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={18} /><p>More connection.<br />Less administration.</p></div><Link className="sidebar-link" href="/"><ArrowUpRight size={18} />Visit the website</Link>{!staff && user && user.role !== "member" && <Link href="/admin" className="sidebar-link"><LayoutDashboard size={18} />Staff workspace</Link>}</div></aside>{open && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}<div className="workspace-main"><header className="workspace-topbar"><div className="flex items-center gap-3"><button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button><span className="workspace-breadcrumb">{staff ? "Workspace" : "Your community"}<ChevronRight size={14} /><span>{links.find(([href]) => href === path)?.[1] ?? "Details"}</span></span></div><div className="flex items-center gap-3"><span className="preview-pill">Preview</span><span className="user-avatar" title={user?.name ?? "Guest"}>{user?.name?.slice(0, 1) ?? "?"}</span></div></header><main id="main-content" className="workspace-content">{loading ? <Loading message="Opening your workspace…" /> : error ? <ErrorNotice message={error} /> : !allowed ? <section className="auth-gate"><div className="empty-icon"><FileText size={28} /></div><h1>{user ? "This area is for your staff team" : "Welcome back"}</h1><p>{user ? "You don't have permission to open this workspace. Your member space is still available." : "Sign in securely to see your connections, profile and next steps."}</p><Button href={user ? "/portal" : "/login"}>{user ? "Go to my community" : "Sign in to continue"}</Button></section> : children}</main></div></div>;
}
