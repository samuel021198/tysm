import { MallLanePage } from "@/components/mall-rails";

export const metadata = { title: "追蹤" };

export default function WatchPage() {
  return <MallLanePage kind="watch" title={["追蹤", "Watching"]} empty={["暫未有追蹤。", "Nothing watched yet."]} />;
}
