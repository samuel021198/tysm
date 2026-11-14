import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";

/** Mobile header: logo only. */
export function TopBar({ locale }: { locale: Locale }) {
  return (
    <div className="md:hidden">
      <div className="mx-auto flex h-[3.25rem] max-w-lg items-center justify-center">
        <Link href="/" aria-label={tx(locale, "主頁", "Home")}>
          <img src="/brand/tsm-monogram.png" alt="" className="block h-7 w-auto bg-transparent" />
        </Link>
      </div>
    </div>
  );
}
