import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        rose: "#C498B2",
        teal: "#7CB9C8",
        link: "var(--link)",
        soft: "var(--soft)",
        danger: "var(--danger)",
        ok: "var(--ok)",
      },
    },
  },
  plugins: [],
};

export default config;
