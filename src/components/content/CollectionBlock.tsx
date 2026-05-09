import type { ResolvedCollection } from "@/types/content"
import EntryList from "./EntryList"

export default function CollectionBlock({ entries, title, viewAll }: ResolvedCollection) {
  return <EntryList entries={entries} title={title} viewAll={viewAll} />
}
