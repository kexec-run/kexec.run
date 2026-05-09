import type { ContentEntry } from "@/types/content"
import EntryRow from "./EntryRow"

type EntryListProps = {
  entries: ContentEntry[]
  title?: string
}

export default function EntryList({ entries, title }: EntryListProps) {
  return (
    <section className="entry-list" aria-label={title}>
      {title ? <h2>{title}</h2> : null}
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
