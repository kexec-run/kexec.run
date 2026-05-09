import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import type {
  CollectionDeclaration,
  CollectionName,
  ContentEntry,
  ContentMetadata,
  PageDeclaration,
  PageName,
  ResolvedPage,
  ResolvedSection,
  SectionDeclaration
} from "@/types/content"

const contentRoot = path.join(process.cwd(), "content")
const collections: CollectionName[] = ["posts", "projects"]

function isCollectionName(value: string): value is CollectionName {
  return collections.includes(value as CollectionName)
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/")
}

function withoutExtension(value: string): string {
  return value.replace(/\.mdx?$/, "")
}

export function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function isSafeContentPath(value: string): boolean {
  return (
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split("/").includes("..") &&
    !value.endsWith("/") &&
    !/\.mdx?$/.test(value)
  )
}

function listMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return listMdxFiles(fullPath)
    }

    if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      return [fullPath]
    }

    return []
  })
}

function normalizeMetadata(data: Record<string, unknown>): ContentMetadata {
  return {
    title: typeof data.title === "string" ? data.title : "Untitled",
    description: typeof data.description === "string" ? data.description : undefined,
    date: typeof data.date === "string" ? data.date : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    published: data.published !== false
  }
}

function firstContentLine(body: string): string {
  return (
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("<")) ?? ""
  )
}

export function getCollectionEntries(collection: CollectionName): ContentEntry[] {
  const collectionRoot = path.join(contentRoot, collection)

  return listMdxFiles(collectionRoot)
    .map((filePath) => {
      const relative = toPosixPath(path.relative(collectionRoot, filePath))
      const slug = withoutExtension(relative).split("/")
      const raw = fs.readFileSync(filePath, "utf8")
      const { data, content } = matter(raw)
      const metadata = normalizeMetadata(data)

      return {
        collection,
        slug,
        href: `/${collection}/${slug.join("/")}`,
        metadata,
        excerpt: metadata.description ?? firstContentLine(content)
      }
    })
    .filter((entry) => entry.metadata.published)
    .sort((a, b) => {
      const left = a.metadata.date ? Date.parse(a.metadata.date) : 0
      const right = b.metadata.date ? Date.parse(b.metadata.date) : 0
      return right - left || a.metadata.title.localeCompare(b.metadata.title)
    })
}

export function getPageMetadata(page: PageName): ContentMetadata {
  const filePath = path.join(contentRoot, "pages", `${page}.mdx`)

  if (!fs.existsSync(filePath)) {
    return normalizeMetadata({})
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const { data } = matter(raw)
  return normalizeMetadata(data)
}

export function resolvePage(declaration: PageDeclaration): ResolvedPage | null {
  if (!isSafeContentPath(declaration.path)) {
    return null
  }

  const pagePath = toPosixPath(declaration.path)
  const filePath = path.join(contentRoot, "pages", `${pagePath}.mdx`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const { data } = matter(raw)

  return {
    path: pagePath,
    metadata: normalizeMetadata(data)
  }
}

export function resolveCollection(declaration: CollectionDeclaration): ContentEntry[] | null {
  if (!isCollectionName(declaration.path)) {
    return null
  }

  const entries = getCollectionEntries(declaration.path)
  const limited = typeof declaration.limit === "number" ? entries.slice(0, declaration.limit) : entries

  return limited.length > 0 ? limited : null
}

export function resolveSections(declarations: SectionDeclaration[]): ResolvedSection[] {
  return declarations.flatMap((section) => {
    if (!isCollectionName(section.path)) {
      return []
    }

    const entries = getCollectionEntries(section.path)

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

export function getStaticParams(collection: CollectionName): Array<{ slug: string[] }> {
  return getCollectionEntries(collection).map((entry) => ({ slug: entry.slug }))
}

export function getEntry(collection: CollectionName, slug: string[]): ContentEntry | null {
  return getCollectionEntries(collection).find((entry) => entry.slug.join("/") === slug.join("/")) ?? null
}

export function getPostTags(): Array<{ tag: string }> {
  const tagSlugs = new Set<string>()

  getCollectionEntries("posts").forEach((entry) => {
    entry.metadata.tags?.forEach((tag) => {
      const slug = slugifyTag(tag)

      if (slug) {
        tagSlugs.add(slug)
      }
    })
  })

  return Array.from(tagSlugs)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ tag }))
}

export function getPostsByTag(tag: string): ContentEntry[] {
  return getCollectionEntries("posts").filter((entry) =>
    entry.metadata.tags?.some((entryTag) => slugifyTag(entryTag) === tag)
  )
}
