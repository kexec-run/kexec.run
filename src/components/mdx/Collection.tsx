import CollectionBlock from "@/components/content/CollectionBlock"
import { resolveCollection } from "@/lib/content"
import type { CollectionDeclaration } from "@/types/content"

export default function Collection({ path, title, limit }: CollectionDeclaration) {
  const entries = resolveCollection({ path, title, limit })

  if (!entries) {
    return null
  }

  return <CollectionBlock entries={entries} title={title} />
}
