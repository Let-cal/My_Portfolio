/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        theme: {
          orange: {
            400: "#fb923c",
            500: "#f97316",
          },
          primary: {
            light: "#ffffff",
            dark: "#1a1a1a", // Dark background
          },
          secondary: {
            light: "#f3f4f6",
            dark: "#2d2d2d", // Dark secondary background
          },
          text: {
            light: "#000000",
            dark: "#ffffff",
          },
          border: {
            light: "#e5e7eb",
            dark: "#404040",
          },
        },
      },
    },
  },
  plugins: [],
};
