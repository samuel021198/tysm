import { newsBrandLogo } from "@/lib/news";

export function NewsCover({
  source,
  coverUrl,
  className = "",
}: {
  source: string;
  color: string;
  coverUrl?: string | null;
  className?: string;
}) {
  if (coverUrl) {
    return <img src={coverUrl} alt="" className={`bg-soft object-cover ${className}`} />;
  }
  const logo = newsBrandLogo(source);
  if (logo) {
    return <img src={logo} alt="" className={`bg-white object-contain p-1.5 ${className}`} />;
  }
  return <span className={`bg-white ${className}`} aria-hidden />;
}
