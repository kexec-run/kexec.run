import type { Metadata } from "next"
import { notFound } from "next/navigation"
import EntryList from "@/components/content/EntryList"
import { getTaggedPosts, getTags } from "@/lib/content"

type PageProps = {
  params: Promise<{
    tag: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getTags().map((tag) => ({ tag: tag.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params
  const resolvedTag = getTags().find((candidate) => candidate.slug === tag)

  if (!resolvedTag) {
    return {}
  }

  return {
    title: `posts tagged ${resolvedTag.label}`,
    description: `Posts tagged ${resolvedTag.label}`
  }
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params
  const resolvedTag = getTags().find((candidate) => candidate.slug === tag)

  if (!resolvedTag) {
    notFound()
  }

  const entries = getTaggedPosts(tag)

  return (
    <main className="prose">
      <h1>posts tagged {resolvedTag.label}</h1>
      {entries.length > 0 ? <EntryList entries={entries} /> : <p>No posts yet.</p>}
    </main>
  )
}
