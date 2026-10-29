import { permanentRedirect } from "next/navigation";

/** Old dex card links open search. */
export default function DexCardPage() {
  permanentRedirect("/find");
}
