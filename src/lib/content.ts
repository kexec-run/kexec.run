import path from "node:path"
import * as queries from "./content/queries.ts"
import { discoverSite as discover } from "./content/discovery.ts"
export { normalizeTags, resolveContentPath, slugifyTag } from "./content/rules.ts"
export { getDeclaredProjectTags } from "./content/parsing.ts"
import type {
  ContentRoute,
  SiteGraph,
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
} from "@/types/content"

const contentRoot = path.join(process.cwd(), "content")

export function getPageMetadata(page: PageName): ContentMetadata {
  return queries.getPageMetadata(contentRoot, page)
}

export function resolvePage(declaration: PageDeclaration): ResolvedPage | null {
  return queries.resolvePage(contentRoot, declaration)
}

export function resolveCollection(declaration: CollectionDeclaration): ResolvedCollection | null {
  return queries.resolveCollection(contentRoot, declaration)
}

export function resolveSections(declarations: SectionDeclaration[]): ResolvedSection[] {
  return queries.resolveSections(contentRoot, declarations)
}

export function getStaticParams(collection: CollectionName): Array<{ slug: string[] }> {
  return queries.getStaticParams(contentRoot, collection)
}

export function getEntry(collection: CollectionName, slug: string[]): ContentEntry | null {
  return queries.getEntry(contentRoot, collection, slug)
}

export function getTags(): ResolvedTag[] {
  return queries.getTags(contentRoot)
}

export function getTaggedPosts(tag: string): ContentEntry[] {
  return queries.getTaggedPosts(contentRoot, tag)
}

export function discoverSite(): SiteGraph {
  return discover(contentRoot)
}

export function getCollectionEntries(collection: CollectionName): ContentEntry[] {
  return queries.getCollectionEntries(contentRoot, collection)
}

export function getContentRoute(slug: string[]): ContentRoute | null {
  return queries.getContentRoute(contentRoot, slug)
}

export function getContentStaticParams(): Array<{ slug: string[] }> {
  return queries.getContentStaticParams(contentRoot)
}

export function resolvePageLink(declaration: PageDeclaration) {
  return queries.resolvePageLink(contentRoot, declaration)
}

export function resolveCollectionLink(declaration: CollectionDeclaration) {
  return queries.resolveCollectionLink(contentRoot, declaration)
}
