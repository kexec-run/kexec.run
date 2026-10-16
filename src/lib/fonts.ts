import { Atkinson_Hyperlegible, Atkinson_Hyperlegible_Mono } from "next/font/google"

export const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-atkinson"
})

export const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  fallback: ["monospace"],
  adjustFontFallback: false,
  variable: "--font-atkinson-mono"
})
