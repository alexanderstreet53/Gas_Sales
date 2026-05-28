import type { Metadata, Viewport } from "next";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gas Tank Detection",
  description: "Geospatial prospecting for industrial gas customers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1320",
};

const NAV = [
  { href: "/",        label: "Dashboard" },
  { href: "/zones",   label: "Zones" },
  { href: "/leads",   label: "Leads" },
  { href: "/review",  label: "Verify" },
  { href: "/label",   label: "Labelling" },
  { href: "/spend",   label: "Spend" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-canvas">
        <header className="border-b border-slate-200 bg-white/85 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto max-w-7xl px-3 sm:px-5 h-14 flex items-center gap-3 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-ink to-accent text-white flex items-center justify-center text-[11px]">
                GT
              </span>
              <span className="text-sm sm:text-base">Gas Tank</span>
            </Link>
            {/* Desktop nav. Hidden on mobile in favour of the bottom tab bar. */}
            <nav className="hidden md:flex gap-5 text-sm text-slate-600">
              {NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="hover:text-ink whitespace-nowrap py-1 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-3 sm:px-5 py-5 sm:py-8 flex-1 pb-safe-nav md:pb-8">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
