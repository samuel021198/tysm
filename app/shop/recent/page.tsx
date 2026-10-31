import { MallLanePage } from "@/components/mall-rails";

export const metadata = { title: "最近瀏覽" };

export default function RecentPage() {
  return <MallLanePage kind="recent" title={["最近瀏覽", "Recently viewed"]} empty={["暫未有最近瀏覽。", "Nothing viewed yet."]} />;
}
