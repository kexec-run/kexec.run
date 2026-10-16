import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { createProcessor } from "@mdx-js/mdx"
import { visit } from "unist-util-visit"
import type {
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
const collections: CollectionName[] = ["posts", "projects"]
const mdxParser = createProcessor()

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[content invariant] ${message}`)
  }
}

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

export function normalizeTags(tags: string[] | undefined): ResolvedTag[] {
  if (!tags) {
    return []
  }

  const seen = new Map<string, string>()

  return tags.flatMap((tag) => {
    const slug = slugifyTag(tag)

    if (!slug) {
      return []
    }

    invariant(!seen.has(slug), `Duplicate tag ${JSON.stringify(tag)} normalizes to ${slug}`)
    seen.set(slug, tag)

    return [{ label: tag, slug, href: `/tags/${slug}` }]
  })
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

function normalizeMetadata(data: Record<string, unknown>, source: string): ContentMetadata {
  if (data.title !== undefined) {
    invariant(typeof data.title === "string" && data.title.trim().length > 0, `Invalid title in ${source}`)
  }
  if (data.description !== undefined) {
    invariant(typeof data.description === "string", `Invalid description in ${source}`)
  }
  if (data.date !== undefined) {
    invariant(
      typeof data.date === "string" && Number.isFinite(Date.parse(data.date)),
      `Invalid date in ${source}`,
    )
  }
  if (data.tags !== undefined) {
    invariant(
      Array.isArray(data.tags) && data.tags.every((tag) => typeof tag === "string"),
      `Invalid tags in ${source}`,
    )
  }
  if (data.status !== undefined) {
    invariant(typeof data.status === "string", `Invalid status in ${source}`)
  }
  if (data.published !== undefined) {
    invariant(typeof data.published === "boolean", `Invalid published flag in ${source}`)
  }
  if (data.showOnHomepage !== undefined) {
    invariant(typeof data.showOnHomepage === "boolean", `Invalid showOnHomepage flag in ${source}`)
  }

  return {
    title: typeof data.title === "string" ? data.title : "Untitled",
    description: typeof data.description === "string" ? data.description : undefined,
    date: typeof data.date === "string" ? data.date : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    published: data.published === undefined ? true : Boolean(data.published),
    showOnHomepage: data.showOnHomepage === undefined ? true : data.showOnHomepage as boolean,
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
  const seenSlugs = new Map<string, string>()

  return listMdxFiles(collectionRoot)
    .map((filePath) => {
      invariant(path.extname(filePath).toLowerCase() === ".mdx", `Unsupported content extension in ${filePath}; use .mdx`)

      const relative = toPosixPath(path.relative(collectionRoot, filePath))
      const slug = withoutExtension(relative).split("/")
      const slugKey = slug.join("/")
      invariant(!seenSlugs.has(slugKey), `Duplicate ${collection} route slug ${slugKey}`)
      seenSlugs.set(slugKey, filePath)

      const raw = fs.readFileSync(filePath, "utf8")
      const { data, content } = matter(raw)
      const metadata = normalizeMetadata(data, filePath)

      return {
        collection,
        slug,
        href: `/${collection}/${slug.join("/")}`,
        metadata,
        tags: normalizeTags(metadata.tags),
        excerpt: metadata.description ?? firstContentLine(content),
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
  invariant(fs.existsSync(filePath), `Missing required page ${filePath}`)

  const raw = fs.readFileSync(filePath, "utf8")
  const { data } = matter(raw)
  return normalizeMetadata(data, filePath)
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
    metadata: normalizeMetadata(data, filePath),
  }
}

function collectionLabel(collection: CollectionName): string {
  return collection
}

export function resolveCollection(declaration: CollectionDeclaration): ResolvedCollection | null {
  if (!isCollectionName(declaration.path)) {
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

  const entries = getCollectionEntries(declaration.path).filter((entry) =>
    !declaration.homepage || declaration.path !== "projects" || entry.metadata.showOnHomepage !== false,
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

export function getDeclaredProjectTags(body: string, source: string): ResolvedTag[] {
  const tags: ResolvedTag[] = []
  const tree = mdxParser.parse(body)

  visit(tree, (node) => {
    if ((node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") || node.name !== "Project") {
      return
    }

    invariant(
      node.attributes.every((attribute) => attribute.type === "mdxJsxAttribute"),
      `Project props must be explicit, without spreads, in ${source}`,
    )
    const stacks = node.attributes.filter((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "stack")
    invariant(stacks.length <= 1, `Duplicate Project stack in ${source}`)
    const stack = stacks[0]
    if (!stack || stack.type !== "mdxJsxAttribute") {
      return
    }

    const value = stack.value
    const statement = typeof value === "object" && value ? value.data?.estree?.body[0] : undefined
    const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined
    invariant(expression?.type === "ArrayExpression", `Project stack must be a literal string array in ${source}`)
    const labels = expression.elements.map((element) => {
      invariant(element?.type === "Literal" && typeof element.value === "string",
        `Project stack must contain only literal strings in ${source}`)
      return element.value
    })
    tags.push(...normalizeTags(labels))
  })

  return tags
}

export function getTags(): ResolvedTag[] {
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

  collections.forEach((collection) => {
    getCollectionEntries(collection).forEach((entry) => entry.tags.forEach(addTag))
  })

  // Discover declarations before rendering; examples in fenced code are not JSX nodes.
  for (const directory of ["pages", ...collections]) {
    listMdxFiles(path.join(contentRoot, directory)).forEach((filePath) => {
      const { data, content } = matter(fs.readFileSync(filePath, "utf8"))
      if (normalizeMetadata(data, filePath).published) {
        getDeclaredProjectTags(content, filePath).forEach(addTag)
      }
    })
  }

  return Array.from(tags.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function getTaggedPosts(tag: string): ContentEntry[] {
  return getCollectionEntries("posts").filter((entry) => entry.tags.some((entryTag) => entryTag.slug === tag))
}
