import type { Metadata } from "next"
import { notFound } from "next/navigation"
import EntryList from "@/components/content/EntryList"
import { getPostTags, getPostsByTag } from "@/lib/content"

type PageProps = {
  params: Promise<{
    tag: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getPostTags()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params
  const entries = getPostsByTag(tag)

  if (entries.length === 0) {
    return {}
  }

  return {
    title: `Posts tagged ${tag}`,
    description: `Posts tagged ${tag}`
  }
}

export default async function PostTagPage({ params }: PageProps) {
  const { tag } = await params
  const entries = getPostsByTag(tag)

  if (entries.length === 0) {
    notFound()
  }

  return (
    <main className="prose">
      <h1>Posts tagged {tag}</h1>
      <EntryList entries={entries} />
    </main>
  )
}
