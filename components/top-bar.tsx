"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { CreatePicker } from "./create-picker";
import { Icon } from "./icons";

/** Mobile header row. Same 5-column grid and icon size as the bottom tab bar. */
export function TopBar({ locale, loggedIn, unread }: { locale: Locale; loggedIn: boolean; unread: number }) {
  const pathname = usePathname();
  const homeOn = pathname === "/";
  const rankOn = pathname === "/rank" || pathname.startsWith("/rank/");
  const notesOn = pathname === "/notifications" || pathname.startsWith("/notifications/");
  const messagesOn = pathname === "/messages" || pathname.startsWith("/messages/");

  return (
    <nav aria-label={tx(locale, "頂欄", "Top")} className="md:hidden">
      <ul className="mx-auto grid h-[3.25rem] max-w-lg grid-cols-5">
        <li className="h-full">
          <Link
            href="/"
            aria-label={tx(locale, "主頁", "Home")}
            aria-current={homeOn ? "page" : undefined}
            className="grid h-full place-items-center"
          >
            <img src="/brand/tsm-monogram.png" alt="" className="block h-7 w-auto bg-transparent" />
          </Link>
        </li>
        <Slot href="/rank" label={tx(locale, "排行榜", "Rankings")} icon="rank" on={rankOn} />
        <li className="grid h-full place-items-center">
          <CreatePicker locale={locale} loggedIn={loggedIn} variant="top" />
        </li>
        <Slot href="/notifications" label={tx(locale, "通知", "Notifications")} icon="bell" on={notesOn} badge={unread} />
        <Slot href="/messages" label={tx(locale, "訊息", "Messages")} icon="messages" on={messagesOn} />
      </ul>
    </nav>
  );
}

function Slot({
  href,
  label,
  icon,
  on,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: "rank" | "bell" | "messages";
  on: boolean;
  badge?: number;
}) {
  return (
    <li className="h-full">
      <Link
        href={href}
        aria-label={badge ? `${label} ${badge}` : label}
        aria-current={on ? "page" : undefined}
        className={`grid h-full place-items-center ${on ? "text-ink" : "text-muted"}`}
      >
        {badge ? (
          <span className="relative grid h-10 w-10 place-items-center">
            <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.6} />
            <Count n={badge} />
          </span>
        ) : (
          <Icon name={icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.6} />
        )}
      </Link>
    </li>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}
