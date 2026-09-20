/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Atkinson Hyperlegible"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        paper: {
          DEFAULT: "#f4efe4",
          50: "#fbf8f2",
          100: "#f4efe4",
          200: "#e7dcc9",
        },
        ink: {
          DEFAULT: "#231c16",
          500: "#3d3228",
          400: "#6b5c4d",
        },
        brick: {
          DEFAULT: "#b55233",
          600: "#9a4024",
          100: "#f3d7cc",
        },
        moss: {
          DEFAULT: "#3f5d4a",
          100: "#dce6df",
        },
      },
      boxShadow: {
        page: "0 1px 0 rgba(35,28,22,0.06)",
      },
    },
  },
  plugins: [],
};
