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
  return getStaticParams("projects")
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const entry = getEntry("projects", slug)

  if (!entry) {
    return {}
  }

  return {
    title: entry.metadata.title,
    description: entry.metadata.description ?? entry.excerpt
  }
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params
  const entry = getEntry("projects", slug)

  if (!entry) {
    notFound()
  }

  const { default: ProjectContent } = await import(`../../../../content/projects/${slug.join("/")}.mdx`)

  return (
    <main>
      <Prose>
        <ProjectContent />
      </Prose>
    </main>
  )
}
