"use client";

import { useFormStatus } from "react-dom";

export function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
