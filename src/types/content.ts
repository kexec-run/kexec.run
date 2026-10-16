export type CollectionName = "posts" | "projects"
export type PageName = "home" | "about" | "projects"

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
}

export type ResolvedPage = {
  path: string
  metadata: ContentMetadata
}
