import ContentDocument from "@/components/content/ContentDocument"
import { resolvePage } from "@/lib/content"
import type { PageDeclaration } from "@/types/content"

export default async function Page(props: PageDeclaration) {
  const page = resolvePage(props)
  return page ? <ContentDocument source={page.path} /> : null
}
