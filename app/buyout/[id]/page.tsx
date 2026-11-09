import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hostedBuyoutPhoto } from "@/lib/buyout-store";
import { displayPhoto } from "@/lib/demo-covers";
import { formatHkd } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { relativeTime } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.buyout.findUnique({ where: { id }, select: { cardName: true } });
  return { title: row?.cardName || "買取" };
}

export default async function BuyoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [prefs, viewer, row] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.buyout.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        user: { select: { id: true, nickname: true, disabled: true } },
      },
    }),
  ]);
  if (!row || row.user.disabled) notFound();
  if (viewer && (await isBlocked(viewer.id, row.userId))) notFound();
  const photos = await Promise.all(row.photos.map(async (photo) => ({ id: photo.id, url: displayPhoto(await hostedBuyoutPhoto(photo)) })));
  const locale = prefs.locale;
  const profileHref = viewer?.id === row.userId ? "/me?tab=buyout" : `/u/${row.user.id}`;
  return (
    <div className="mx-auto grid max-w-3xl gap-3 pb-[calc(var(--tab-h)+1rem)] md:pb-0">
      <ul className="grid grid-cols-3 gap-px">
        {photos.map((photo) => (
          <li key={photo.id}>
            <img src={photo.url} alt="" className="block aspect-square w-full bg-soft object-cover" />
          </li>
        ))}
      </ul>
      <div className="grid gap-2 px-1">
        <h1 className="text-[15px] font-semibold leading-snug">{row.cardName}</h1>
        <p className="flex flex-wrap items-center gap-2">
          <span className="price text-sm">{formatHkd(row.priceCents, locale)}</span>
          {row.negotiable ? (
            <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink">{tx(locale, "可議價", "Negotiable")}</span>
          ) : null}
        </p>
        <p className="whitespace-pre-wrap text-sm">{row.note}</p>
        {row.handover ? <p className="text-sm text-muted">{row.handover}</p> : null}
        <p className="text-sm text-muted">{relativeTime(row.createdAt, new Date(), locale)}</p>
        <Link href={profileHref} className="text-sm font-medium text-ink">
          {row.user.nickname}
        </Link>
      </div>
    </div>
  );
}
