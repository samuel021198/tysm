import { permanentRedirect } from "next/navigation";

/** Old dex links open search. The encyclopedia is not a page. */
export default function DexPage() {
  permanentRedirect("/find");
}
