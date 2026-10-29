import { redirect } from "next/navigation";

/** Older links land on the profile 收藏 tab. That tab is the only favorites list. */
export default function FavoritesPage() {
  redirect("/me?tab=saved");
}
