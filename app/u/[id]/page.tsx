import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { openDirectThread, toggleFollow } from "@/actions/social";
import { Icon } from "@/components/icons";
import { ProfileBoard } from "@/components/profile-board";
import { ProfileHeader } from "@/components/profile-header";
import { PersonMenu } from "@/components/safety-menu";
import { Flash } from "@/components/shell";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { profileContent } from "@/lib/profile";
import { isBlocked } from "@/lib/social";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id }, select: { nickname: true } });
  return { title: person?.nickname || "個人頁" };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, person] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.user.findUnique({ where: { id } }),
  ]);
  if (!person) notFound();
  if (viewer?.id === person.id) redirect("/me");
  if (viewer && (await isBlocked(viewer.id, person.id))) notFound();
  const [following, board] = await Promise.all([
    viewer ? prisma.follow.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: person.id } } }) : null,
    profileContent(person.id, viewer?.id ?? null),
  ]);
  const locale = prefs.locale;
  const base = `/u/${person.id}`;
  return (
    <div className="mx-auto grid max-w-3xl gap-3 pb-[calc(var(--tab-h)+1rem)] md:pb-0">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <ProfileHeader
        locale={locale}
        userId={person.id}
        base={base}
        nickname={person.nickname}
        avatarUrl={person.avatarUrl}
        bio={person.bio}
        links={person.profileLinks}
        interestTags={person.interestTags}
        handoverPlace={person.handoverPlace}
        rating={board.rating}
        followers={board.followers}
        postCount={board.postCount}
        listingCount={board.listingCount}
        verificationTier={person.verificationTier}
      >
        {viewer ? (
          <div className="flex items-center gap-2">
            <form action={toggleFollow} className="min-w-0 flex-1">
              <input type="hidden" name="sellerId" value={person.id} />
              <input type="hidden" name="next" value={base} />
              <button className="btn btn-ghost w-full">{following ? tx(locale, "已關注", "Following") : tx(locale, "關注", "Follow")}</button>
            </form>
            <form action={openDirectThread}>
              <input type="hidden" name="userId" value={person.id} />
              <input type="hidden" name="next" value={base} />
              <button type="submit" className="btn btn-ghost w-11 shrink-0 px-0" aria-label={tx(locale, "訊息", "Message")}>
                <Icon name="messages" className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </form>
            <PersonMenu locale={locale} userId={person.id} reportType="USER" reportId={person.id} next={base} away="/" />
          </div>
        ) : null}
      </ProfileHeader>
      <div id="profile-posts">
        <ProfileBoard
          locale={locale}
          base={base}
          tab={sp.tab || "posts"}
          isSelf={false}
          posts={board.posts}
          postsNext={board.postsNext}
          ownerId={person.id}
          savedListings={board.savedListings}
          savedPosts={board.savedPosts}
          listings={board.listings}
          inventory={board.inventory}
          reviews={board.reviews}
          drafts={board.drafts}
          favIds={board.favIds}
          viewerId={viewer?.id ?? null}
        />
      </div>
    </div>
  );
}
