import type { NewsItem } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { newsSortAt, newsSourceLine } from "@/lib/news";
import { NewsCover } from "@/components/news-cover";

export const metadata = { title: "新聞" };

export default async function NewsPage() {
  const prefs = await getPrefs();
  // Source time, not ingest time. createdAt is required, so the key is never null.
  const rows = await prisma.$queryRaw<NewsItem[]>`SELECT * FROM "NewsItem" ORDER BY COALESCE("eventAt", "createdAt") DESC`;
  const now = new Date();
  const locale = prefs.locale;

  return (
    <div className="-mx-3 min-h-[70vh] bg-card px-3 md:mx-0 md:rounded-2xl md:px-4">
      <div className="mx-auto max-w-lg py-2">
        <h1 className="mb-1 text-lg font-semibold">{tx(locale, "新聞", "News")}</h1>
        {rows.length === 0 ? <p className="py-10 text-center text-sm text-muted">{tx(locale, "暫時未有卡聞。", "No card news yet.")}</p> : null}
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="border-b border-line last:border-b-0">
              <Link href={`/news/${row.slug}`} className="flex items-start gap-3 py-3">
                <NewsCover source={row.source} coverUrl={row.coverUrl} className="h-[72px] w-[72px] shrink-0 rounded-lg text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{row.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{newsSourceLine(row.source, newsSortAt(row), now, locale)}</span>
                  {row.teaser ? <span className="mt-0.5 block truncate text-[13px] text-muted">{row.teaser}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
