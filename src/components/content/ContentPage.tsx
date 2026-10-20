import { notFound } from "next/navigation"
import ContentDocument from "./ContentDocument"
import CollectionBlock from "./CollectionBlock"
import { resolveCollection } from "@/lib/content"
import type { CollectionDeclaration } from "@/types/content"
import Prose from "@/components/ui/Prose"
import { getContentRoute } from "@/lib/content"

export default function ContentPage({ slug }: { slug: string[] }) {
  const route = getContentRoute(slug)
  if (!route) notFound()
  const collection = route.kind === "index" ? route.source.slice(0, -"/index".length) : undefined
  function IndexCollection(props: CollectionDeclaration) {
    const resolved = resolveCollection(props)
    if (!resolved) return null
    return <CollectionBlock {...resolved} viewAll={props.path === collection ? undefined : resolved.viewAll} />
  }
  return (
    <main>
      <Prose>
        {route.kind !== "page" ? <h1>{route.metadata.title}</h1> : null}
        {route.kind === "index" && route.metadata.description ? <p>{route.metadata.description}</p> : null}
        {route.kind === "entry" && route.metadata.date ? (
          <time className="content-date" dateTime={route.metadata.date}>{route.metadata.date}</time>
        ) : null}
        <ContentDocument source={route.source} components={collection ? { Collection: IndexCollection } : undefined} />
      </Prose>
    </main>
  )
}
