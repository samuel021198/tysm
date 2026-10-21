"use client";

import { useFormStatus } from "react-dom";

export function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
