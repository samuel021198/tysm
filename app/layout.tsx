import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { Footer, Header } from "@/components/shell";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "TYSM", template: "%s · TYSM" },
  description: "Hong Kong marketplace for trading cards. HKD, escrow, auctions and offers.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [viewer, prefs] = await Promise.all([getViewer(), getPrefs()]);
  const [cartCount, unread] = viewer
    ? await Promise.all([
        prisma.cartItem.count({ where: { userId: viewer.id } }),
        prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),
      ])
    : [0, 0];
  return (
    <html lang={prefs.locale === "en" ? "en" : "zh-HK"} className={prefs.theme === "dark" ? "dark" : undefined}>
      <body>
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2" href="#main">
          Skip
        </a>
        <Header locale={prefs.locale} theme={prefs.theme} user={viewer} cartCount={cartCount} unread={unread} />
        <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">
          {children}
        </main>
        <Footer locale={prefs.locale} />
      </body>
    </html>
  );
}
