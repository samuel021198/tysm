import { redirect } from "next/navigation";
import { updatePost } from "@/actions/collect";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { TopicField } from "@/components/topic-field";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer, post] = await Promise.all([
    getPrefs(),
    getViewer(),
    prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true, body: true } }),
  ]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/post/${id}/edit`)}`);
  if (!post || post.authorId !== viewer.id) redirect("/?err=forbidden");
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Flash locale={prefs.locale} ok={sp.ok} err={sp.err} />
      <form action={updatePost} className="grid gap-2">
        <input type="hidden" name="postId" value={post.id} />
        <TopicField locale={prefs.locale} defaultValue={post.body} placeholder={tx(prefs.locale, "寫幾隻字", "Write a few lines.")} />
        <button className="btn btn-primary w-fit">{tx(prefs.locale, "儲存", "Save")}</button>
      </form>
    </div>
  );
}
