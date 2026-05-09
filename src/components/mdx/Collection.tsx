import CollectionBlock from "@/components/content/CollectionBlock"
import { resolveCollection } from "@/lib/content"
import type { CollectionDeclaration } from "@/types/content"

export default function Collection({ path, title, limit }: CollectionDeclaration) {
  const collection = resolveCollection({ path, title, limit })

  if (!collection) {
    return null
  }

  return <CollectionBlock {...collection} />
}
