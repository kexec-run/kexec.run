export type CollectionName = string
export type PageName = string

export type SectionDeclaration = {
  label: string
  path: CollectionName
}

export type ResolvedSection = {
  label: string
  href: string
  count: number
}

export type ContentMetadata = {
  title: string
  description?: string
  date?: string
  tags?: string[]
  status?: string
  published: boolean
  showOnHomepage?: boolean
}

export type ResolvedTag = {
  label: string
  slug: string
  href: string
}

export type ContentEntry = {
  collection: CollectionName
  slug: string[]
  href: string
  metadata: ContentMetadata
  tags: ResolvedTag[]
  excerpt: string
}

export type CollectionDeclaration = {
  path: CollectionName
  title?: string
  limit?: number
  homepage?: boolean
}

export type CollectionLink = {
  href: string
  label: string
}

export type ResolvedCollection = {
  entries: ContentEntry[]
  title?: string
  viewAll?: CollectionLink
}

export type PageDeclaration = {
  path: string
  /** Declaring document, supplied by the MDX renderer. */
  from?: string
  title?: string
  slot?: "header" | "main" | "footer"
}

export type ResolvedPage = {
  path: string
  metadata: ContentMetadata
}

export type ContentRoute = {
  href: string
  source: string
  metadata: ContentMetadata
  kind: "page" | "index" | "entry"
}

export type SiteGraph = {
  home: string
  routes: ContentRoute[]
  collections: string[]
  sources: string[]
}
