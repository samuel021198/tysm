import type { ReactNode } from "react";

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  const inline = (value: string) =>
    value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>,
    );
  const flush = () => {
    if (!list.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc pl-5">
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith("- ")) list.push(line.slice(2));
    else {
      flush();
      nodes.push(
        <p key={`p-${nodes.length}`} className="min-h-4">
          {inline(line) || " "}
        </p>,
      );
    }
  }
  flush();
  return <div className="space-y-1 text-sm leading-6">{nodes}</div>;
}
