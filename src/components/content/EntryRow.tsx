import Link from "next/link"
import type { ContentEntry } from "@/types/content"

type EntryRowProps = {
  entry: ContentEntry
}

export default function EntryRow({ entry }: EntryRowProps) {
  const titleOnly = entry.collection === "projects"

  return (
    <article className="entry-row">
      <div className={titleOnly ? "entry-row-main entry-row-title-only" : "entry-row-main"}>
        {!titleOnly && entry.metadata.date ? <time dateTime={entry.metadata.date}>{entry.metadata.date}</time> : null}
        <h3>
          <Link href={entry.href}>{entry.metadata.title.toLowerCase()}</Link>
        </h3>
        {!titleOnly && entry.tags.length > 0 ? (
          <ul className="entry-tags" aria-label={`${entry.metadata.title} tags`}>
            {entry.tags.map((tag) => (
              <li key={tag.slug}>
                <Link href={tag.href}>{tag.label}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}
