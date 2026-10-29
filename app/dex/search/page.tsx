import { permanentRedirect } from "next/navigation";

/** Old dex search opens search. */
export default function DexSearchPage() {
  permanentRedirect("/find");
}
