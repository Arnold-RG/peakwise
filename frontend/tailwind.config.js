/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Syne", "Avenir Next Condensed", "Segoe UI", "sans-serif"],
        sans: ["Sora", "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        slateink: {
          DEFAULT: "#0f172a",
          soft: "#151f33",
        },
        teal: {
          electric: "#2ee6d6",
          deep: "#14b8a6",
        },
      },
    },
  },
  plugins: [],
};
