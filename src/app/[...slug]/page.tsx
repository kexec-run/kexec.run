import type { Metadata } from "next"
import ContentPage from "@/components/content/ContentPage"
import { getContentRoute, getContentStaticParams } from "@/lib/content"

type PageProps = { params: Promise<{ slug: string[] }> }

export const dynamicParams = false
export const generateStaticParams = getContentStaticParams

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const route = getContentRoute(slug)
  return route ? { title: route.metadata.title, description: route.metadata.description } : {}
}

export default async function DocumentPage({ params }: PageProps) {
  const { slug } = await params
  return <ContentPage slug={slug} />
}
