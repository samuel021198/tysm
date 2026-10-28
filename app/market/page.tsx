import { permanentRedirect } from "next/navigation";

/** Old market links open search. Browsing lives on /find. */
export default function MarketPage() {
  permanentRedirect("/find");
}
