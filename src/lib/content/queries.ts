import { invariant, isSafeContentPath, normalizeTags, resolveContentPath } from "./rules.ts"
import { getDeclaredProjectTags } from "./parsing.ts"
import { contentExists, readDocument, readPageMetadata } from "./filesystem.ts"
import { readCollectionEntries } from "./entries.ts"
import { discoverSite } from "./discovery.ts"
import type {
  ContentRoute,
  CollectionDeclaration,
  CollectionName,
  ContentEntry,
  ContentMetadata,
  PageDeclaration,
  PageName,
  ResolvedCollection,
  ResolvedPage,
  ResolvedSection,
  ResolvedTag,
  SectionDeclaration
} from "../../types/content"

export function getPageMetadata(root: string, page: PageName): ContentMetadata {
  return readPageMetadata(root, page)
}

export function resolvePage(root: string, declaration: PageDeclaration): ResolvedPage | null {
  const source = resolveContentPath("Page", declaration.path, declaration.from)
  if (!contentExists(root, `${source}.mdx`)) return null
  const { metadata } = readDocument(root, source)
  return metadata.published ? { path: source, metadata } : null
}

function collectionLabel(collection: CollectionName): string {
  return collection
}

export function resolveCollection(root: string, declaration: CollectionDeclaration): ResolvedCollection | null {
  if (!isSafeContentPath(declaration.path)) {
    return null
  }

  if (declaration.limit !== undefined) {
    invariant(
      typeof declaration.limit === "number" && Number.isInteger(declaration.limit) && declaration.limit >= 0,
      `Invalid collection limit for ${declaration.path}`,
    )
  }

  if (declaration.homepage !== undefined) {
    invariant(typeof declaration.homepage === "boolean", `Invalid homepage flag for ${declaration.path}`)
  }

  const entries = getCollectionEntries(root, declaration.path).filter((entry) =>
    !declaration.homepage || entry.metadata.showOnHomepage !== false,
  )
  const limited = typeof declaration.limit === "number" ? entries.slice(0, declaration.limit) : entries

  if (limited.length === 0) {
    return null
  }

  return {
    entries: limited,
    title: declaration.title,
    viewAll: {
      href: `/${declaration.path}`,
      label: `all ${collectionLabel(declaration.path)}`,
    },
  }
}

export function resolveSections(root: string, declarations: SectionDeclaration[]): ResolvedSection[] {
  return declarations.flatMap((section) => {
    if (!isSafeContentPath(section.path)) {
      return []
    }

    const entries = getCollectionEntries(root, section.path)

    if (entries.length === 0) {
      return []
    }

    return [
      {
        label: section.label,
        href: `/${section.path}`,
        count: entries.length
      }
    ]
  })
}

export function getStaticParams(root: string, collection: CollectionName): Array<{ slug: string[] }> {
  return getCollectionEntries(root, collection).map((entry) => ({ slug: entry.slug }))
}

export function getEntry(root: string, collection: CollectionName, slug: string[]): ContentEntry | null {
  return getCollectionEntries(root, collection).find((entry) => entry.slug.join("/") === slug.join("/")) ?? null
}

export function getTags(root: string): ResolvedTag[] {
  const tags = new Map<string, ResolvedTag>()
  const addTag = (tag: ResolvedTag) => {
    const existing = tags.get(tag.slug)
    invariant(
      !existing || existing.label === tag.label,
      `Tag labels ${JSON.stringify(existing?.label)} and ${JSON.stringify(tag.label)} share slug ${tag.slug}`,
    )
    if (!existing) {
      tags.set(tag.slug, tag)
    }
  }

  // Only reachable, published documents contribute tags.
  for (const source of discoverSite(root).sources) {
    const { metadata, body } = readDocument(root, source)
    normalizeTags(metadata.tags).forEach(addTag)
    getDeclaredProjectTags(body, source).forEach(addTag)
  }

  return Array.from(tags.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function getTaggedPosts(root: string, tag: string): ContentEntry[] {
  return getCollectionEntries(root, "posts").filter((entry) => entry.tags.some((entryTag) => entryTag.slug === tag))
}

export function getCollectionEntries(root: string, collection: CollectionName): ContentEntry[] {
  const site = discoverSite(root)
  if (!site.collections.includes(collection)) return []
  const published = new Set(site.routes.map((route) => route.href))
  return readCollectionEntries(root, collection).filter((entry) => published.has(entry.href))
}

export function getContentRoute(root: string, slug: string[]): ContentRoute | null {
  const href = slug.length ? `/${slug.join("/")}` : "/"
  return discoverSite(root).routes.find((route) => route.href === href) ?? null
}

export function getContentStaticParams(root: string): Array<{ slug: string[] }> {
  return discoverSite(root).routes.filter((route) => route.href !== "/")
    .map((route) => ({ slug: route.href.slice(1).split("/") }))
}

export function resolvePageLink(root: string, { path: page, title, from }: PageDeclaration) {
  const source = resolveContentPath("Page", page, from)
  const route = discoverSite(root).routes.find((candidate) => candidate.source === source)
  return route ? { href: route.href, label: title ?? route.metadata.title } : null
}

export function resolveCollectionLink(root: string, { path: collection, title }: CollectionDeclaration) {
  const route = discoverSite(root).routes.find((candidate) => candidate.href === `/${collection}`)
  return route ? { href: route.href, label: title ?? route.metadata.title } : null
}
