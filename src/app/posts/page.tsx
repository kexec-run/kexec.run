import type { Metadata } from "next"
import EntryList from "@/components/content/EntryList"
import { getCollectionEntries } from "@/lib/content"

export const metadata: Metadata = {
  title: "Posts",
  description: "Published posts from the filesystem content tree"
}

export default function PostsPage() {
  const entries = getCollectionEntries("posts")

  return (
    <main className="prose">
      <h1>Posts</h1>
      <EntryList entries={entries} />
    </main>
  )
}
