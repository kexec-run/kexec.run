import type { ComponentType } from "react"
import type { MDXComponents } from "mdx/types"
import { mdxComponents } from "@/lib/mdx"
import { resolveContentPath } from "@/lib/content"
import Page from "@/components/mdx/Page"
import Collection from "@/components/mdx/Collection"
import type { PageDeclaration, CollectionDeclaration } from "@/types/content"

export default async function ContentDocument({ source, components = {} }: {
  source: string
  components?: MDXComponents
}) {
  const { default: Document } = await import(`../../../content/${source}.mdx`)
  const PageComponent = (components.Page ?? Page) as ComponentType<PageDeclaration>
  const CollectionComponent = (components.Collection ?? Collection) as ComponentType<CollectionDeclaration>
  function BoundPage(props: PageDeclaration) {
    return <PageComponent {...props} from={source} />
  }
  function BoundCollection(props: CollectionDeclaration) {
    return <CollectionComponent {...props} path={resolveContentPath("Collection", props.path, source)} />
  }
  return <Document components={{ ...mdxComponents, ...components, Page: BoundPage, Collection: BoundCollection }} />
}
