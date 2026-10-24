import { redirect } from "next/navigation";
import { getPrefs, getViewer } from "@/lib/auth";
import { StoryComposer } from "@/components/story-composer";

export default async function NewStoryPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/story/new");
  return <StoryComposer locale={prefs.locale} />;
}
