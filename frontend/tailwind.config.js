/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
      },
      colors: {
        // "Empathy" Color System
        surface: "#FFF1F2", // Soft Lace Pink - background
        card: "#FFFFFF",    // Pure white for cards
        primary: {
          DEFAULT: "#F43F5E", // Warm Rose Pink
          hover: "#E11D48",
          light: "#FFE4E6",
        },
        text: {
          primary: "#0F172A",   // Deep Slate
          secondary: "#475569", // Medium Slate
        },
        status: {
          critical: "#E11D48", // Deep Crimson
          warning: "#FBBF24",  // Warm Amber
          success: "#10B981",  // Emerald Green
        },
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'floating': '0 10px 40px -10px rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
};
