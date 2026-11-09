"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CREATE_HREF, createDest } from "@/lib/create-modes";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

/** Top-left ＋. One path: 上架. */
export function CreatePicker({
  locale,
  loggedIn,
  variant,
  label,
}: {
  locale: Locale;
  loggedIn: boolean;
  variant: "top" | "header";
  label?: string;
}) {
  const pathname = usePathname();
  const creating = pathname.startsWith("/sell") || pathname.startsWith("/add");
  const className =
    variant === "header"
      ? "inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 text-sm font-medium text-link ring-1 ring-inset ring-accent/15 hover:bg-accent/15"
      : `grid h-full w-full place-items-center ${creating ? "text-ink" : "text-muted"}`;

  return (
    <Link
      href={createDest(CREATE_HREF, loggedIn)}
      className={className}
      aria-label={variant === "header" && label ? undefined : tx(locale, "上架", "List")}
      aria-current={variant === "top" && creating ? "page" : undefined}
    >
      <Icon
        name="plus"
        className={variant === "header" ? "h-3.5 w-3.5" : "h-[22px] w-[22px]"}
        strokeWidth={variant === "header" ? 2.25 : creating ? 2 : 1.6}
      />
      {variant === "header" ? label : null}
    </Link>
  );
}
