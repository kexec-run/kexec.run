import path from "node:path"
import { collectionDocuments, readContentFile } from "./filesystem.ts"
import { firstContentLine, invariant, isSafeContentPath, normalizeTags, toPosixPath, withoutExtension } from "./rules.ts"
import type { CollectionName, ContentEntry } from "../../types/content"

export function readCollectionEntries(root: string, collection: CollectionName): ContentEntry[] {
  if (!isSafeContentPath(collection) || collection === "pages") return []
  const collectionRoot = path.join(root, collection)
  const seenSlugs = new Map<string, string>()

  return collectionDocuments(root, collection).entries
    .map((filePath) => {
      invariant(path.extname(filePath).toLowerCase() === ".mdx", `Unsupported content extension in ${filePath}; use .mdx`)

      const relative = toPosixPath(path.relative(collectionRoot, filePath))
      const slug = withoutExtension(relative).split("/")
      const slugKey = slug.join("/")
      invariant(!seenSlugs.has(slugKey), `Duplicate ${collection} route slug ${slugKey}`)
      seenSlugs.set(slugKey, filePath)

      const { metadata, body } = readContentFile(root, toPosixPath(path.relative(root, filePath)))

      return {
        collection,
        slug,
        href: `/${collection}/${slug.join("/")}`,
        metadata,
        tags: normalizeTags(metadata.tags),
        excerpt: metadata.description ?? firstContentLine(body),
      }
    })
    .filter((entry) => entry.metadata.published)
    .sort((a, b) => {
      const left = a.metadata.date ? Date.parse(a.metadata.date) : 0
      const right = b.metadata.date ? Date.parse(b.metadata.date) : 0
      return right - left || a.metadata.title.localeCompare(b.metadata.title)
    })
}
