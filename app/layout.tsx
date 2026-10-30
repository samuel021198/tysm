import type { Metadata, Viewport } from "next";
import { Noto_Sans_HK, Sora } from "next/font/google";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { Footer, Header } from "@/components/shell";
import { TabBar } from "@/components/tab-bar";
import { TabSwipe } from "@/components/tab-swipe";
import "./globals.css";

const sans = Noto_Sans_HK({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8fa",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "TSM", template: "%s · TSM" },
  description: "Hong Kong marketplace for trading cards. Private handover, chat, and listings.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [viewer, prefs] = await Promise.all([getViewer(), getPrefs()]);
  const [cartCount, noteUnread, msgUnread] = viewer
    ? await Promise.all([
        prisma.cartItem.count({ where: { userId: viewer.id } }),
        prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),
        prisma.message.count({
          where: {
            readAt: null,
            senderId: { not: viewer.id },
            thread: { OR: [{ buyerId: viewer.id }, { sellerId: viewer.id }] },
          },
        }),
      ])
    : [0, 0, 0];
  // Badge if either stream has unread; prefer the notification count when both do.
  const unread = noteUnread || msgUnread;
  return (
    <html lang={prefs.locale === "en" ? "en" : "zh-HK"} className={`${sans.variable} ${display.variable}${prefs.theme === "dark" ? " dark" : ""}`}>
      <body className="font-sans antialiased">
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2" href="#main">
          Skip
        </a>
        <Header locale={prefs.locale} theme={prefs.theme} user={viewer} cartCount={cartCount} unread={unread} />
        <main id="main" className="mx-auto min-h-[70vh] w-full max-w-6xl px-3 py-3 md:px-4 md:py-5">
          <TabSwipe loggedIn={Boolean(viewer)}>{children}</TabSwipe>
        </main>
        <Footer locale={prefs.locale} />
        <TabBar locale={prefs.locale} loggedIn={Boolean(viewer)} />
      </body>
    </html>
  );
}
