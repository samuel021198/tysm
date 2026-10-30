"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";
import { CreatePicker } from "./create-picker";
import { Icon } from "./icons";

/** Mobile header: create · logo · notifications hub. */
export function TopBar({ locale, loggedIn, unread }: { locale: Locale; loggedIn: boolean; unread: number }) {
  const pathname = usePathname();
  const homeOn = pathname === "/";
  const hubOn =
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/");

  return (
    <nav aria-label={tx(locale, "頂欄", "Top")} className="md:hidden">
      <ul className="mx-auto grid h-[3.25rem] max-w-lg grid-cols-3">
        <li className="h-full">
          <CreatePicker locale={locale} loggedIn={loggedIn} variant="top" />
        </li>
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
        <li className="h-full">
          <Link
            href="/notifications"
            aria-label={unread ? `${tx(locale, "通知", "Notifications")} ${unread}` : tx(locale, "通知", "Notifications")}
            aria-current={hubOn ? "page" : undefined}
            className={`grid h-full place-items-center ${hubOn ? "text-ink" : "text-muted"}`}
          >
            {unread ? (
              <span className="relative grid h-10 w-10 place-items-center">
                <Icon name="bell" className="h-[22px] w-[22px]" strokeWidth={hubOn ? 2 : 1.6} />
                <Count n={unread} />
              </span>
            ) : (
              <Icon name="bell" className="h-[22px] w-[22px]" strokeWidth={hubOn ? 2 : 1.6} />
            )}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}
