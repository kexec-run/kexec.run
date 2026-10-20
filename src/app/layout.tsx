import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"
import Container from "@/components/layout/Container"
import SiteShell from "@/components/layout/SiteShell"
import { discoverSite } from "@/lib/content"
import { atkinson, atkinsonMono } from "@/lib/fonts"

export function generateMetadata(): Metadata {
  const home = discoverSite().routes.find((route) => route.href === "/")!
  return { title: home.metadata.title, description: home.metadata.description }
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${atkinson.className} ${atkinson.variable} ${atkinsonMono.variable}`}>
        <Container><SiteShell>{children}</SiteShell></Container>
      </body>
    </html>
  )
}
