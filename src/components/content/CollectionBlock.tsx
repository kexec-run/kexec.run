import type { ContentEntry } from "@/types/content"
import EntryList from "./EntryList"

type CollectionBlockProps = {
  entries: ContentEntry[]
  title?: string
}

export default function CollectionBlock({ entries, title }: CollectionBlockProps) {
  return <EntryList entries={entries} title={title} />
}
