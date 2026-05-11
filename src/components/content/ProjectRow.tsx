import Link from "next/link"
import type { ReactNode } from "react"
import type { ResolvedTag } from "@/types/content"

type ProjectLink = {
  href: string
  external: boolean
}

type ProjectRowProps = {
  children: ReactNode
  link?: ProjectLink
  period?: string
  position?: string
  stack: ResolvedTag[]
  title: string
}

export default function ProjectRow({ children, link, period, position, stack, title }: ProjectRowProps) {
  return (
    <article className="project-entry">
      <header className="project-entry-header">
        <h2>
          {link?.external ? (
            <a href={link.href} rel="noreferrer" target="_blank">
              {title}
            </a>
          ) : link ? (
            <Link href={link.href}>{title}</Link>
          ) : (
            title
          )}
        </h2>
        {position || period ? (
          <p className="project-entry-meta">
            {[position, period].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </header>

      <div className="project-entry-description">{children}</div>

      {stack.length > 0 ? (
        <ul className="project-entry-stack" aria-label={`${title} stack`}>
          {stack.map((tag) => (
            <li key={tag.slug}>
              <Link href={tag.href}>{tag.label}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
