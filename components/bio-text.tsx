import { bioSegments } from "@/lib/profile-edit";

export function BioText({ text }: { text: string }) {
  const parts = bioSegments(text);
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a key={index} href={part.href} className="text-link underline underline-offset-2" target="_blank" rel="noreferrer">
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}
