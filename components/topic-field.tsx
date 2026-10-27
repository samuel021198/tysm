"use client";

import { useRef, useState } from "react";
import { tx, type Locale } from "@/lib/i18n";
import { hashPartial, insertTag, tagsFromCaption, topicSuggestions } from "@/lib/tags";

export function TopicSuggest({
  locale,
  tags,
  partial,
  onPick,
}: {
  locale: Locale;
  tags: string[];
  partial: string | null;
  onPick: (tag: string) => void;
}) {
  const chosen = new Set(tags.map((tag) => tag.toLowerCase()));
  const rows = topicSuggestions(partial).filter((tag) => !chosen.has(tag.toLowerCase()));
  if (!rows.length) return null;
  return (
    <div className="grid gap-1">
      <p className="text-[11px] leading-4 text-muted">{tx(locale, "話題", "Topics")}</p>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((tag) => (
          <button
            key={tag}
            type="button"
            className="h-8 rounded-full bg-soft px-2.5 text-[11px] leading-4 text-muted"
            onClick={() => onPick(tag)}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TopicField({
  locale,
  name = "body",
  defaultValue = "",
  value,
  onChange,
  maxLength = 500,
  placeholder,
}: {
  locale: Locale;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [inner, setInner] = useState(defaultValue);
  const body = value ?? inner;
  const [cursor, setCursor] = useState((value ?? defaultValue).length);

  function setBody(next: string) {
    if (onChange) onChange(next);
    else setInner(next);
  }
  const tags = tagsFromCaption(body);
  const partial = hashPartial(body, cursor);

  function sync(next: string, caret: number) {
    setBody(next);
    setCursor(caret);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="grid gap-2">
      <textarea
        ref={ref}
        className="field min-h-28"
        name={name}
        maxLength={maxLength}
        value={body}
        placeholder={placeholder ?? tx(locale, "寫幾隻字，可以加 #PC #FS #ISO", "Write a few lines. #PC #FS #ISO work too.")}
        aria-label={tx(locale, "內文", "Caption")}
        onChange={(event) => {
          setBody(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? body.length)}
      />
      <TopicSuggest
        locale={locale}
        tags={tags}
        partial={partial}
        onPick={(tag) => {
          const next = insertTag(body, cursor, tag);
          sync(next.text, next.cursor);
        }}
      />
    </div>
  );
}
