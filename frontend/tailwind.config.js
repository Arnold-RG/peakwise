/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', "Iowan Old Style", "Palatino", "Georgia", "serif"],
        sans: ['Outfit', "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
