import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"
import Container from "@/components/layout/Container"
import SiteFooter from "@/components/layout/SiteFooter"
import SiteHeader from "@/components/layout/SiteHeader"
import { resolveSections } from "@/lib/content"
import { atkinson, atkinsonMono } from "@/lib/fonts"
import type { ResolvedSection, SectionDeclaration } from "@/types/content"

const primarySections: SectionDeclaration[] = [
  { label: "blog", path: "posts" },
  { label: "projects", path: "projects" }
]

const homeSection: ResolvedSection = {
  label: "home",
  href: "/",
  count: 1
}

export const metadata: Metadata = {
  title: "Filesystem MDX Site",
  description: "A static-first filesystem-driven MDX site"
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const sections = [homeSection, ...resolveSections(primarySections)]

  return (
    <html lang="en">
      <body className={`${atkinson.variable} ${atkinsonMono.variable}`}>
        <Container>
          {sections.length > 0 ? <SiteHeader sections={sections} /> : null}
          <div className="site-main">{children}</div>
          <SiteFooter />
        </Container>
      </body>
    </html>
  )
}
