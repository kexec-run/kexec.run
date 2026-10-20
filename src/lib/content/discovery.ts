import path from "node:path"
import { invariant, toPosixPath } from "./rules.ts"
import { parseReferences } from "./parsing.ts"
import { collectionDocuments, contentExists, readDocument } from "./filesystem.ts"
import { readCollectionEntries } from "./entries.ts"
import type { ContentRoute, SiteGraph } from "../../types/content"

type Reference = {
  name: "Page" | "Collection"
  path: string
  slot?: "header" | "main" | "footer"
}

function getReferences(body: string, source: string): Reference[] {
  const references: Reference[] = []
  for (const reference of parseReferences(body, source)) {
    const slot = reference.slot
    invariant(!slot || (source === "shell/index" && reference.name === "Page" &&
      ["header", "main", "footer"].includes(slot)), `Invalid shell slot in ${source}`)
    references.push({ ...reference, slot: slot as Reference["slot"] })
  }
  return references
}

export function discoverSite(root: string): SiteGraph {
  const routes = new Map<string, ContentRoute>()
  const sources = new Set<string>()
  const collections = new Set<string>()
  const visiting = new Set<string>()
  const shell = readDocument(root, "shell/index")
  invariant(shell.metadata.published, "shell/index.mdx must be published")
  const shellReferences = getReferences(shell.body, "shell/index")
  for (const slot of ["header", "main", "footer"]) {
    invariant(shellReferences.filter((reference) => reference.slot === slot).length <= 1,
      `Duplicate shell slot ${slot}`)
  }
  const main = shellReferences.filter((reference) => reference.slot === "main")
  invariant(main.length === 1, "shell/index.mdx requires exactly one Page with slot=main")
  const home = main[0].path
  const fragments = new Set(shellReferences.filter((reference) => reference.slot && reference.slot !== "main")
    .map((reference) => reference.path))

  function addRoute(source: string, href: string, kind: ContentRoute["kind"]) {
    invariant(!/^\/tags(?:\/|$)/.test(href), `Content route ${href} collides with reserved tags routes`)
    const previous = routes.get(href)
    invariant(!previous || previous.source === source, `Route collision at ${href}: ${previous?.source} and ${source}`)
    const { metadata } = readDocument(root, source)
    if (metadata.published) routes.set(href, { source, href, metadata, kind })
  }

  function walkDocument(source: string) {
    invariant(!visiting.has(source), `Circular Page reference: ${[...visiting, source].join(" -> ")}`)
    if (sources.has(source)) return
    const { metadata, body } = readDocument(root, source)
    if (!metadata.published) return
    sources.add(source)
    visiting.add(source)
    for (const reference of getReferences(body, source)) {
      if (reference.name === "Collection") {
        walkCollection(reference.path)
      } else {
        const target = reference.path
        if (!fragments.has(target)) {
          const href = target === home ? "/" : `/${target.replace(/^pages\//, "").replace(/\/index$/, "")}`
          const kind = target.startsWith("pages/") ? "page" : target.endsWith("/index") ? "index" : "entry"
          addRoute(target, href, kind)
        }
        walkDocument(target)
      }
    }
    visiting.delete(source)
  }

  function walkCollection(collection: string) {
    invariant(!["pages", "shell"].includes(collection.split("/")[0]), `Reserved collection path ${collection}`)
    if (collections.has(collection)) return
    // Missing folders remain harmless declarations, as before.
    if (!contentExists(root, collection)) return
    const index = `${collection}/index`
    const { metadata } = readDocument(root, index)
    if (!metadata.published) return
    collections.add(collection)
    addRoute(index, `/${collection}`, "index")
    walkDocument(index)
    for (const entry of readCollectionEntries(root, collection)) {
      const source = `${collection}/${entry.slug.join("/")}`
      addRoute(source, entry.href, "entry")
      walkDocument(source)
    }
    // Nested indexes are sections too, with their own publication boundary.
    for (const directoryPath of collectionDocuments(root, collection).sections) {
      walkCollection(toPosixPath(path.relative(root, directoryPath)))
    }
  }

  walkDocument("shell/index")
  invariant(routes.has("/"), "The shell main page must be published")
  return { home, routes: [...routes.values()], collections: [...collections], sources: [...sources] }
}
