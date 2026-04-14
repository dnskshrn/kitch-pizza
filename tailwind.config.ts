import type { Config } from "tailwindcss"

/** Дублирует покрытие для инструментов; основной пайплайн Tailwind v4 — @source в globals.css */
const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
} satisfies Config

export default config
