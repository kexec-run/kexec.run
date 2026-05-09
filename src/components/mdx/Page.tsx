import { resolvePage } from "@/lib/content"
import type { PageDeclaration } from "@/types/content"

export default async function Page({ path }: PageDeclaration) {
  const page = resolvePage({ path })

  if (!page) {
    return null
  }

  const { default: PageContent } = await import(`../../../content/pages/${page.path}.mdx`)

  return <PageContent />
}
