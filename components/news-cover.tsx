import { newsBrandLogo } from "@/lib/news";

export function NewsCover({
  source,
  coverUrl,
  className = "",
  fit = "cover",
}: {
  source: string;
  coverUrl?: string | null;
  className?: string;
  /** Detail passes contain so a portrait slab is not cropped into a strip. */
  fit?: "cover" | "contain";
}) {
  if (coverUrl) {
    const framed = fit === "contain" ? "object-contain" : "object-cover";
    return <img src={coverUrl} alt="" className={`bg-soft ${framed} ${className}`} />;
  }
  const logo = newsBrandLogo(source);
  if (logo) {
    return <img src={logo} alt="" className={`bg-white object-contain p-1.5 ${className}`} />;
  }
  return <span className={`bg-white ${className}`} aria-hidden />;
}
