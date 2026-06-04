/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#0D0D1A",
          card: "#1A1A2E",
          gold: "#D4AF37",
          accent: "#FFD700",
          muted: "#888888",
        },
      },
    },
  },
  plugins: [],
};
