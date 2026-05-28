"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item { href: string; label: string; icon: (active: boolean) => React.ReactNode }

const ITEMS: Item[] = [
  { href: "/",       label: "Home",   icon: a => <HomeIcon active={a} /> },
  { href: "/zones",  label: "Zones",  icon: a => <MapIcon active={a} /> },
  { href: "/leads",  label: "Leads",  icon: a => <UsersIcon active={a} /> },
  { href: "/review", label: "Verify", icon: a => <CheckIcon active={a} /> },
  { href: "/spend",  label: "Spend",  icon: a => <ChartIcon active={a} /> },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe">
      <ul className="grid grid-cols-5">
        {ITEMS.map(item => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                  active ? "text-ink" : "text-slate-500"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.icon(active)}
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function stroke(active: boolean) { return active ? 2.25 : 1.75; }

function HomeIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-6h-4v6a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2z"/></svg>;
}
function MapIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
}
function UsersIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CheckIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}
function ChartIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(active)} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>;
}
