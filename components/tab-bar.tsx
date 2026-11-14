"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { subscribeTabIntent, tabHref } from "@/lib/tabs";
import { Icon } from "./icons";

export function TabBar({
  locale,
  loggedIn,
  messageUnread,
  noticeUnread,
}: {
  locale: Locale;
  loggedIn: boolean;
  messageUnread: number;
  noticeUnread: number;
}) {
  const pathname = usePathname();
  const [intent, setIntent] = useState<number | null>(null);
  useEffect(() => subscribeTabIntent(setIntent), []);
  const tabs = [
    {
      href: tabHref(0, loggedIn)!,
      label: "賣場",
      icon: "bag" as const,
      badge: 0,
      on:
        pathname === "/shop" ||
        pathname.startsWith("/shop/") ||
        pathname === "/find" ||
        pathname.startsWith("/find/") ||
        pathname === "/search" ||
        pathname.startsWith("/search/"),
    },
    {
      href: tabHref(1, loggedIn)!,
      label: "Message",
      icon: "messages" as const,
      badge: messageUnread,
      on: pathname === "/messages" || pathname.startsWith("/messages/"),
    },
    {
      href: tabHref(2, loggedIn)!,
      label: "加",
      icon: "plus" as const,
      badge: 0,
      on: pathname.startsWith("/add") || pathname.startsWith("/sell"),
    },
    {
      href: tabHref(3, loggedIn)!,
      label: "消息",
      icon: "bell" as const,
      badge: noticeUnread,
      on: pathname.startsWith("/notifications") || pathname === "/news" || pathname.startsWith("/news/"),
    },
    {
      href: tabHref(4, loggedIn)!,
      label: "個人頁",
      icon: "me" as const,
      badge: 0,
      on: pathname.startsWith("/me") || pathname.startsWith("/login") || pathname.startsWith("/orders"),
    },
  ];

  return (
    <nav
      aria-label={tx(locale, "主要", "Main")}
      className="tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-[3.25rem] max-w-lg grid-cols-5">
        {tabs.map((tab, index) => (
          <Tab key={tab.label} {...tab} on={intent == null ? tab.on : intent === index} />
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
  badge,
}: {
  href: string;
  label: string;
  icon: "bag" | "messages" | "plus" | "bell" | "me";
  on: boolean;
  badge: number;
}) {
  return (
    <li className="h-full min-w-0">
      <Link
        href={href}
        aria-label={badge > 0 ? `${label} ${badge}` : label}
        aria-current={on ? "page" : undefined}
        className={`flex h-full flex-col items-center justify-center gap-0.5 px-0.5 ${on ? "text-ink" : "text-muted"}`}
      >
        <span className="relative">
          <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.6} />
          {badge > 0 ? <Count n={badge} /> : null}
        </span>
        <span className="max-w-full truncate text-[11px] font-medium leading-none">{label}</span>
      </Link>
    </li>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#dc2626] px-1 text-[10px] font-semibold leading-none text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}
