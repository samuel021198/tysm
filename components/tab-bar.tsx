"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

export function TabBar({ locale, loggedIn }: { locale: Locale; loggedIn: boolean }) {
  const pathname = usePathname();
  const meHref = loggedIn ? "/me" : "/login";
  const tabs = [
    { href: "/", label: tx(locale, "主頁", "Home"), icon: "home" as const, on: pathname === "/" },
    {
      href: "/dex",
      label: tx(locale, "圖鑑", "Dex"),
      icon: "book" as const,
      on: pathname === "/dex" || pathname.startsWith("/dex/"),
    },
    {
      href: "/market",
      label: tx(locale, "賣場", "Market"),
      icon: "bag" as const,
      on:
        pathname === "/market" ||
        pathname.startsWith("/market/") ||
        pathname.startsWith("/listing/") ||
        pathname.startsWith("/shop"),
    },
    {
      href: "/search",
      label: tx(locale, "搜尋", "Search"),
      icon: "search" as const,
      on: pathname === "/search" || pathname.startsWith("/search/"),
    },
    {
      href: meHref,
      label: tx(locale, "個人", "Profile"),
      icon: "me" as const,
      on: pathname.startsWith("/me") || pathname.startsWith("/login") || pathname.startsWith("/orders") || pathname.startsWith("/notifications"),
    },
  ];

  return (
    <nav
      aria-label={tx(locale, "主要", "Main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-[3.25rem] max-w-lg grid-cols-5">
        {tabs.map((tab) => (
          <Tab key={tab.href} {...tab} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({
  href,
  label,
  icon,
  on,
}: {
  href: string;
  label: string;
  icon: "home" | "book" | "bag" | "search" | "me";
  on: boolean;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        aria-label={label}
        aria-current={on ? "page" : undefined}
        className={`flex h-full items-center justify-center ${on ? "text-ink" : "text-muted"}`}
      >
        <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.6} />
      </Link>
    </li>
  );
}
