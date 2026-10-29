"use client";

import { useRef, useState } from "react";
import { tx, type Locale } from "@/lib/i18n";
import { startHashtag } from "@/lib/tags";

export function HashtagHint({ locale, onAdd }: { locale: Locale; onAdd: () => void }) {
  return (
    <button type="button" className="min-h-11 w-fit text-left text-sm text-link" onClick={onAdd}>
      {tx(locale, "建議加 #hashtag", "Add a #hashtag")}
    </button>
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
        placeholder={placeholder ?? tx(locale, "寫幾隻字", "Write a few lines.")}
        aria-label={tx(locale, "內文", "Caption")}
        onChange={(event) => {
          setBody(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? body.length)}
      />
      <HashtagHint
        locale={locale}
        onAdd={() => {
          const next = startHashtag(body, cursor);
          sync(next.text, next.cursor);
        }}
      />
    </div>
  );
}
