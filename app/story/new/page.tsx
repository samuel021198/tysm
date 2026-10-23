import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { StoryComposer } from "@/components/story-composer";

export default async function NewStoryPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/story/new");
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <h1 className="page-title mb-0">{tx(prefs.locale, "發限時動態", "New story")}</h1>
      <p className="text-sm text-muted">{tx(prefs.locale, "只收相片。發佈之後 24 小時自動收起。", "Photos only. It comes down 24 hours after you post.")}</p>
      <StoryComposer locale={prefs.locale} />
    </div>
  );
}
