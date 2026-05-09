import Link from "next/link"
import type { ContentEntry } from "@/types/content"
import { slugifyTag } from "@/lib/content"

type EntryRowProps = {
  entry: ContentEntry
}

export default function EntryRow({ entry }: EntryRowProps) {
  return (
    <article className="entry-row">
      <div className="entry-row-main">
        {entry.metadata.date ? <time dateTime={entry.metadata.date}>{entry.metadata.date}</time> : null}
        <h3>
          <Link href={entry.href}>{entry.metadata.title}</Link>
        </h3>
        {entry.metadata.tags && entry.metadata.tags.length > 0 ? (
          <ul className="entry-tags" aria-label={`${entry.metadata.title} tags`}>
            {entry.metadata.tags.map((tag) => (
              <li key={tag}>
                <Link href={`/posts/tags/${slugifyTag(tag)}`}>{tag}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}
