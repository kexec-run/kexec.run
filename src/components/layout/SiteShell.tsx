import type { ReactNode } from "react"
import Link from "next/link"
import ContentDocument from "@/components/content/ContentDocument"
import Footer from "@/components/layout/Footer"
import { discoverSite, resolveCollectionLink, resolvePage, resolvePageLink } from "@/lib/content"
import type { CollectionDeclaration, PageDeclaration } from "@/types/content"

function NavigationPage(props: PageDeclaration) {
  const link = resolvePageLink(props)
  return link ? <Link href={link.href}>{link.label}</Link> : null
}

function NavigationCollection(props: CollectionDeclaration) {
  const link = resolveCollectionLink(props)
  return link ? <Link href={link.href}>{link.label}</Link> : null
}

export default function SiteShell({ children }: { children: ReactNode }) {
  // Validate the complete publication graph before rendering any document.
  discoverSite()
  async function ShellPage(props: PageDeclaration) {
    const { slot } = props
    const page = resolvePage(props)
    if (!page) return null
    if (slot === "main") return <div className="site-main">{children}</div>
    if (slot === "header") {
      return (
        <header className="site-header">
          <ContentDocument source={page.path} components={{ Page: NavigationPage, Collection: NavigationCollection }} />
        </header>
      )
    }
    const content = <ContentDocument source={page.path} />
    return slot === "footer" ? <Footer>{content}</Footer> : content
  }
  return <ContentDocument source="shell/index" components={{ Page: ShellPage }} />
}
