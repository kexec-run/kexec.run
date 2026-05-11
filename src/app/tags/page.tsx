import Link from "next/link"
import type { Metadata } from "next"
import { getTags } from "@/lib/content"

export const metadata: Metadata = {
  title: "Tags",
  description: "Global tags across posts and projects"
}

export default function TagsPage() {
  const tags = getTags()

  return (
    <main className="prose">
      <h1>tags</h1>
      {tags.length > 0 ? (
        <ul className="tag-index" aria-label="tags">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <Link href={tag.href}>{tag.label}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No tags yet.</p>
      )}
    </main>
  )
}
