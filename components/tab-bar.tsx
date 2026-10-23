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
    { href: "/search", label: tx(locale, "搜尋", "Search"), icon: "search" as const, on: pathname.startsWith("/search") },
    { href: "/sell", label: tx(locale, "上架", "Sell"), icon: "plus" as const, on: pathname.startsWith("/sell") },
    { href: "/messages", label: tx(locale, "訊息", "Messages"), icon: "messages" as const, on: pathname.startsWith("/messages") },
    {
      href: meHref,
      label: tx(locale, "我的", "Me"),
      icon: "me" as const,
      on: pathname.startsWith("/me") || pathname.startsWith("/login") || pathname.startsWith("/orders") || pathname.startsWith("/notifications"),
    },
  ];

  return (
    <nav
      aria-label={tx(locale, "主要", "Main")}
      className="fixed inset-x-0 bottom-0 z-40 bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line),0_-12px_32px_rgba(34,24,32,0.06)] md:hidden"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5">
        {tabs.map((tab) => (
          <li key={tab.label}>
            <Link
              href={tab.href}
              aria-current={tab.on ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${tab.on ? "text-ink" : "text-muted"}`}
            >
              <Icon name={tab.icon} strokeWidth={tab.on ? 2.15 : 1.7} />
              <span>{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
