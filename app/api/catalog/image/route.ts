import { NextResponse } from "next/server";
import { CATALOG_UA } from "@/lib/catalog-http";
import { officialOpImageUrl } from "@/lib/catalog-image";

export async function GET(request: Request) {
  const src = officialOpImageUrl(new URL(request.url).searchParams.get("src") || "");
  if (!src) return new NextResponse("bad image", { status: 400 });
  const upstream = await fetch(src, {
    headers: { accept: "image/*", "user-agent": CATALOG_UA },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (upstream.status !== 200) return new NextResponse("image missing", { status: 502 });
  const type = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) return new NextResponse("not an image", { status: 502 });
  const bytes = await upstream.arrayBuffer();
  // ponytail: 2MB cap. Card pngs are ~200KB. Upgrade path: stream with a hard abort if a file grows past this.
  if (bytes.byteLength > 2_000_000) return new NextResponse("too large", { status: 502 });
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
