import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
      <body className="min-h-screen flex flex-col">
        <header className="border-b bg-white sticky top-0 z-30">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 flex items-center gap-3 sm:gap-6">
            <Link href="/" className="font-semibold tracking-tight whitespace-nowrap text-sm sm:text-base">
              Gas Tank
            </Link>
            <nav className="flex gap-3 sm:gap-4 text-sm text-slate-600 overflow-x-auto no-scrollbar -mx-1 px-1">
              {NAV.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="hover:text-ink whitespace-nowrap py-1"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-3 sm:px-4 py-4 sm:py-6 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
