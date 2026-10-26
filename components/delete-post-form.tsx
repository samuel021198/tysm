"use client";

import { deletePost } from "@/actions/collect";

export function DeletePostForm({ postId, label, confirmLabel }: { postId: string; label: string; confirmLabel: string }) {
  return (
    <form
      action={deletePost}
      onSubmit={(event) => {
        if (!window.confirm(confirmLabel)) event.preventDefault();
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="btn btn-ghost text-danger">
        {label}
      </button>
    </form>
  );
}
