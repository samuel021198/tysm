"use client";

export function ConfirmSubmit({ label, message }: { label: string; message: string }) {
  return (
    <button
      className="text-sm text-link underline"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
