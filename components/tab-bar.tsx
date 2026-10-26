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
        pathname.startsWith("/search") ||
        pathname.startsWith("/shop"),
    },
    { href: "/messages", label: tx(locale, "聊天", "Chat"), icon: "messages" as const, on: pathname.startsWith("/messages") },
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
  icon: "home" | "book" | "bag" | "messages" | "me";
  on: boolean;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium leading-none ${on ? "text-ink" : "text-muted"}`}
      >
        <span className="grid h-[18px] w-[18px] place-items-center">
          <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={on ? 2 : 1.6} />
        </span>
        <span>{label}</span>
      </Link>
    </li>
  );
}
