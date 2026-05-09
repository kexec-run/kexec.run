import Link from "next/link"
import type { ReactNode } from "react"
import { slugifyTag } from "@/lib/content"

type ProjectProps = {
  children: ReactNode
  href?: string
  period?: string
  position?: string
  stack?: string[]
  title: string
}

export default function Project({ children, href, period, position, stack = [], title }: ProjectProps) {
  const isExternalHref = href ? /^https?:\/\//.test(href) : false

  return (
    <article className="project-entry">
      <header className="project-entry-header">
        <h2>
          {href && isExternalHref ? (
            <a href={href} rel="noreferrer" target="_blank">
              {title}
            </a>
          ) : href ? (
            <Link href={href}>{title}</Link>
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
          {stack.map((tag) => {
            const slug = slugifyTag(tag)

            return (
              <li key={tag}>
                <Link href={`/posts/tags/${slug}`}>{tag}</Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </article>
  )
}
