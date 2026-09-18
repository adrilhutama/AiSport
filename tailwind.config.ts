import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        terminal: {
          950: "#06090e",
          900: "#0b111a",
          850: "#101827",
          800: "#162234",
          700: "#1f314b",
          600: "#2d4468",
          500: "#44628d",
          border: "#1e293b",
        },
        matrix: {
          green: "#10b981",
          emerald: "#059669",
          cyan: "#06b6d4",
          amber: "#f59e0b",
          red: "#ef4444",
        }
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
