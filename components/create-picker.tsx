import Link from "next/link";
import { CREATE_HREF, createDest } from "@/lib/create-modes";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

/** Desktop header ＋. One path: 上架. Mobile 加 is the center bottom tab. */
export function CreatePicker({ locale, loggedIn, label }: { locale: Locale; loggedIn: boolean; label?: string }) {
  return (
    <Link
      href={createDest(CREATE_HREF, loggedIn)}
      className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 text-sm font-medium text-link ring-1 ring-inset ring-accent/15 hover:bg-accent/15"
      aria-label={label ? undefined : tx(locale, "上架", "List")}
    >
      <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.25} />
      {label}
    </Link>
  );
}
