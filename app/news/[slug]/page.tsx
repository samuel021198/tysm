import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/auth";
import { newsDetailCopy, newsSourceLine } from "@/lib/news";
import { NewsCover } from "@/components/news-cover";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await prisma.newsItem.findUnique({ where: { slug }, select: { title: true } });
  return { title: row?.title || "新聞" };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [prefs, row] = await Promise.all([getPrefs(), prisma.newsItem.findUnique({ where: { slug } })]);
  if (!row) notFound();
  const locale = prefs.locale;
  const { copy, sourceUrl } = newsDetailCopy(row.body, row.linkUrl);

  return (
    <article className="mx-auto grid max-w-lg gap-3">
      <NewsCover source={row.source} coverUrl={row.coverUrl} className="aspect-[4/5] max-h-80 w-full rounded-2xl text-3xl" />
      <h1 className="text-xl font-semibold leading-snug">{row.title}</h1>
      <p className="text-sm text-muted">{newsSourceLine(row.source, row.updatedAt, new Date(), locale)}</p>
      {copy || sourceUrl ? (
        <p className="whitespace-pre-wrap text-sm leading-6">
          {copy}
          {sourceUrl ? (
            <>
              {copy ? "\n\n" : null}
              Source:{" "}
              <a className="break-words text-link underline" href={sourceUrl} target="_blank" rel="noreferrer">
                {sourceUrl}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}
