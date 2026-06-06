import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202A",
        muted: "#657080",
        line: "#D9DEE5",
        panel: "#F7F8FA",
        brand: "#0F766E",
        accent: "#B45309"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
