import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Prose from "@/components/ui/Prose"
import { getEntry, getStaticParams } from "@/lib/content"

type PageProps = {
  params: Promise<{
    slug: string[]
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getStaticParams("posts")
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const entry = getEntry("posts", slug)

  if (!entry) {
    return {}
  }

  return {
    title: entry.metadata.title,
    description: entry.metadata.description ?? entry.excerpt
  }
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const entry = getEntry("posts", slug)

  if (!entry) {
    notFound()
  }

  const { default: PostContent } = await import(`../../../../content/posts/${slug.join("/")}.mdx`)

  return (
    <main>
      <Prose>
        <PostContent />
      </Prose>
    </main>
  )
}
