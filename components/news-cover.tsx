export function NewsCover({
  source,
  color,
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
  return (
    <span className={`grid place-items-center font-semibold text-white ${className}`} style={{ backgroundColor: color }} aria-hidden>
      {source.slice(0, 1)}
    </span>
  );
}
