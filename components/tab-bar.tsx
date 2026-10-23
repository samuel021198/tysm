"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { AddSheet } from "./add-sheet";
import { Icon } from "./icons";

export function TabBar({ locale, loggedIn }: { locale: Locale; loggedIn: boolean }) {
  const pathname = usePathname();
  const meHref = loggedIn ? "/me" : "/login";
  const tabs = [
    { href: "/", label: tx(locale, "主頁", "Home"), icon: "home" as const, on: pathname === "/" },
    { href: "/search", label: tx(locale, "賣場", "Market"), icon: "search" as const, on: pathname.startsWith("/search") || pathname.startsWith("/listing") },
    { href: "/messages", label: tx(locale, "聊天", "Chat"), icon: "messages" as const, on: pathname.startsWith("/messages") },
    {
      href: meHref,
      label: tx(locale, "個人", "Profile"),
      icon: "me" as const,
      on: pathname.startsWith("/me") || pathname.startsWith("/login") || pathname.startsWith("/orders") || pathname.startsWith("/notifications"),
    },
  ];
  const adding = pathname.startsWith("/add") || pathname.startsWith("/sell") || pathname.startsWith("/story");

  return (
    <nav
      aria-label={tx(locale, "主要", "Main")}
      className="fixed inset-x-0 bottom-0 z-40 bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line),0_-12px_32px_rgba(34,24,32,0.06)] md:hidden"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5">
        {tabs.slice(0, 2).map((tab) => (
          <Tab key={tab.label} {...tab} />
        ))}
        <li className="h-full">
          <AddSheet locale={locale} loggedIn={loggedIn} variant="tab" active={adding} />
        </li>
        {tabs.slice(2).map((tab) => (
          <Tab key={tab.label} {...tab} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ href, label, icon, on }: { href: string; label: string; icon: "home" | "search" | "messages" | "me"; on: boolean }) {
  return (
    <li className="h-full">
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? "text-ink" : "text-muted"}`}
      >
        <Icon name={icon} strokeWidth={on ? 2.15 : 1.7} />
        <span>{label}</span>
      </Link>
    </li>
  );
}
