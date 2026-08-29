/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3b6fff",
          600: "#2a57e0",
          700: "#1f43b8",
        },
      },
    },
  },
  plugins: [],
};
