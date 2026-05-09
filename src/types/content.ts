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
}

export type ContentEntry = {
  collection: CollectionName
  slug: string[]
  href: string
  metadata: ContentMetadata
  excerpt: string
}

export type CollectionDeclaration = {
  path: CollectionName
  title?: string
  limit?: number
}

export type PageDeclaration = {
  path: string
}

export type ResolvedPage = {
  path: string
  metadata: ContentMetadata
}
