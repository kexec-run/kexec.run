import Link from "next/link"
import type { ContentEntry } from "@/types/content"
import EntryRow from "./EntryRow"

type EntryListProps = {
  entries: ContentEntry[]
  title?: string
  viewAll?: {
    href: string
    label: string
  }
}

export default function EntryList({ entries, title, viewAll }: EntryListProps) {
  return (
    <section className="entry-list" aria-label={title}>
      {title || viewAll ? (
        <div className="entry-list-header">
          {title ? <h2>{title}</h2> : null}
          {viewAll ? (
            <Link className="entry-list-more" href={viewAll.href}>
              {viewAll.label} -&gt;
            </Link>
          ) : null}
        </div>
      ) : null}
      <ol>
        {entries.map((entry) => (
          <li key={entry.href}>
            <EntryRow entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  )
}
