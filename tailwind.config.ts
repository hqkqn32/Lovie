import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A8A", // Lovie navy
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#06B6D4", // Lovie teal
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#DBEAFE", // Light blue
          foreground: "#1E3A8A",
        },
      },
    },
  },
  plugins: [],
}

export default config

