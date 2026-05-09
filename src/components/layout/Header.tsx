import Link from "next/link"
import type { ResolvedSection } from "@/types/content"

type HeaderProps = {
  sections: ResolvedSection[]
}

export default function Header({ sections }: HeaderProps) {
  return (
    <header className="site-header">
      <nav aria-label="Primary navigation" className="site-nav">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            {section.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
