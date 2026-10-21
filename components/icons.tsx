export function Icon({
  name,
  className = "h-6 w-6",
  strokeWidth = 1.75,
}: {
  name: "home" | "search" | "plus" | "messages" | "me" | "bag" | "bell" | "sun" | "moon";
  className?: string;
  strokeWidth?: number;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "home") {
    return (
      <svg {...props}>
        <path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="6.25" />
        <path d="m16 16 3.5 3.5" />
      </svg>
    );
  }
  if (name === "plus") {
    return (
      <svg {...props}>
        <path d="M12 6.5v11M6.5 12h11" />
      </svg>
    );
  }
  if (name === "messages") {
    return (
      <svg {...props}>
        <path d="M6 17.5 4 20V7.2A2.2 2.2 0 0 1 6.2 5h11.6A2.2 2.2 0 0 1 20 7.2v7.1a2.2 2.2 0 0 1-2.2 2.2z" />
      </svg>
    );
  }
  if (name === "me") {
    return (
      <svg {...props}>
        <circle cx="12" cy="9" r="3.1" />
        <path d="M6.2 19.2c.8-2.6 3-4 5.8-4s5 1.4 5.8 4" />
      </svg>
    );
  }
  if (name === "bag") {
    return (
      <svg {...props}>
        <path d="M6.2 8.2h11.6l-.8 11.2H7z" />
        <path d="M9 8.2V7.1a3 3 0 0 1 6 0v1.1" />
      </svg>
    );
  }
  if (name === "bell") {
    return (
      <svg {...props}>
        <path d="M6 16.2V10a6 6 0 1 1 12 0v6.2l1.4 1.8H4.6z" />
        <path d="M10 18.6a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M5.8 5.8l1.3 1.3M16.9 16.9l1.3 1.3M18.2 5.8l-1.3 1.3M7.1 16.9l-1.3 1.3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M20 15.2A8.2 8.2 0 0 1 9.4 5.2 7 7 0 1 0 20 15.2z" />
    </svg>
  );
}
