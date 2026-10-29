"use client";

import { useState } from "react";
import { saveProfile } from "@/actions/auth";
import { tx, type Locale } from "@/lib/i18n";
import { BIO_MAX, parseInterestTags } from "@/lib/profile-edit";

export function ProfileEditForm({
  locale,
  nickname,
  username,
  usernameLeft,
  bio,
  links,
  handoverPlace,
  interestTags,
  avatarUrl,
}: {
  locale: Locale;
  nickname: string;
  username: string;
  usernameLeft: number;
  bio: string;
  links: string[];
  handoverPlace: string;
  interestTags: string;
  avatarUrl: string | null;
}) {
  const [body, setBody] = useState(bio);
  const [tags, setTags] = useState(interestTags);
  const parsed = parseInterestTags(tags);
  const tagCount = parsed.ok ? parsed.tags.length : null;
  const slots = [links[0] || "", links[1] || "", links[2] || ""];
  return (
    <form action={saveProfile} className="surface divide-y divide-line overflow-hidden">
      <label className="grid gap-2 px-3 py-3">
        <span className="text-xs font-medium text-muted">{tx(locale, "頭像", "Avatar")}</span>
        <span className="flex items-center gap-3">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-lg font-semibold text-white">{nickname.slice(0, 1)}</span>}
          <input className="text-sm" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" />
        </span>
        <input className="field" name="avatarUrl" defaultValue={avatarUrl || ""} placeholder="https://" inputMode="url" />
      </label>
      <label className="grid gap-1 px-3 py-3">
        <span className="text-xs font-medium text-muted">{tx(locale, "顯示名稱", "Display name")}</span>
        <input className="field" name="nickname" defaultValue={nickname} required minLength={2} maxLength={24} />
      </label>
      <label className="grid gap-1 px-3 py-3">
        <span className="text-xs font-medium text-muted">{tx(locale, "用戶名稱", "Username")}</span>
        <input className="field" name="username" defaultValue={username} placeholder="@name" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <span className="text-xs text-muted">
          {tx(locale, `30 日內仲可以改 ${usernameLeft} 次`, `${usernameLeft} changes left in 30 days`)}
        </span>
      </label>
      <label className="grid gap-1 px-3 py-3">
        <span className="flex items-center justify-between text-xs font-medium text-muted">
          {tx(locale, "簡介", "Bio")}
          <span className={body.trim().length > BIO_MAX ? "text-danger" : ""}>
            {body.trim().length}/{BIO_MAX}
          </span>
        </span>
        <textarea className="field min-h-28 py-2" name="bio" value={body} maxLength={BIO_MAX} onChange={(event) => setBody(event.target.value)} />
      </label>
      <fieldset className="grid gap-2 px-3 py-3">
        <legend className="text-xs font-medium text-muted">{tx(locale, "連結", "Links")}</legend>
        {slots.map((value, index) => (
          <input key={index} className="field" name="link" defaultValue={value} placeholder={tx(locale, "https:// 或商場名稱", "https:// or a mall name")} inputMode="url" />
        ))}
      </fieldset>
      <label className="grid gap-1 px-3 py-3">
        <span className="text-xs font-medium text-muted">{tx(locale, "交收地區", "Handover area")}</span>
        <input className="field" name="handoverPlace" defaultValue={handoverPlace} maxLength={40} placeholder={tx(locale, "地區或商場，唔好填街號", "District or mall, no street number")} />
      </label>
      <label className="grid gap-1 px-3 py-3">
        <span className="flex items-center justify-between text-xs font-medium text-muted">
          {tx(locale, "興趣話題", "Interest tags")}
          <span className={tagCount == null || tagCount > 8 ? "text-danger" : ""}>{tagCount ?? "–"}/8</span>
        </span>
        <input className="field" name="interestTags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="#寶可夢 #TCG" />
      </label>
      <div className="px-3 py-3">
        <button className="btn btn-primary w-full">{tx(locale, "儲存", "Save")}</button>
      </div>
    </form>
  );
}
