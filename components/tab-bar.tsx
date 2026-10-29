"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { subscribeTabIntent } from "@/lib/tabs";
import { Icon } from "./icons";

export function TabBar({ locale, loggedIn }: { locale: Locale; loggedIn: boolean }) {
  const pathname = usePathname();
  const [intent, setIntent] = useState<number | null>(null);
  useEffect(() => subscribeTabIntent(setIntent), []);
  const meHref = loggedIn ? "/me" : "/login";
  const tabs = [
    { href: "/", label: tx(locale, "主頁", "Home"), icon: "home" as const, on: pathname === "/" },
    {
      href: "/news",
      label: tx(locale, "新聞", "News"),
      icon: "news" as const,
      on: pathname === "/news" || pathname.startsWith("/news/"),
    },
    {
      href: "/find",
      label: tx(locale, "搜尋", "Search"),
      icon: "search" as const,
      accent: true,
      on: pathname === "/find" || pathname.startsWith("/find/") || pathname.startsWith("/search"),
    },
    {
      href: "/rank",
      label: tx(locale, "排行", "Rank"),
      icon: "rank" as const,
      on: pathname === "/rank" || pathname.startsWith("/rank/"),
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
      className="tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-[3.25rem] max-w-lg grid-cols-5">
        {tabs.map((tab, index) => (
          <Tab key={tab.href} {...tab} on={intent == null ? tab.on : intent === index} />
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
  accent = false,
}: {
  href: string;
  label: string;
  icon: "home" | "news" | "search" | "rank" | "me";
  on: boolean;
  accent?: boolean;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        aria-label={label}
        aria-current={on ? "page" : undefined}
        className={`grid h-full place-items-center ${accent ? "text-white" : on ? "text-ink" : "text-muted"}`}
      >
        {accent ? (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white">
            <Icon name={icon} className="h-[22px] w-[22px] text-white" strokeWidth={2} />
          </span>
        ) : (
          <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.6} />
        )}
      </Link>
    </li>
  );
}
