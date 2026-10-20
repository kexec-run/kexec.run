import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { createProcessor } from "@mdx-js/mdx"
import { visit } from "unist-util-visit"
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
const mdxParser = createProcessor()

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[content invariant] ${message}`)
  }
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
  return /^(?!.*\.mdx?$)[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value)
}

/** Resolve authored paths to extensionless paths under content/. */
export function resolveContentPath(kind: "Page" | "Collection", target: string, from?: string): string {
  const relative = target === "." || target === ".." || target.startsWith("./") || target.startsWith("../")
  invariant(!relative || from, `Relative ${kind} path ${target} needs a declaring document`)
  // Validate segments before normalization so traversal cannot hide malformed paths.
  invariant(target.replace(/\/$/, "").split("/").every((segment) => segment === "." || segment === ".." ||
    /^[a-zA-Z0-9_-]+$/.test(segment)), `Invalid ${kind} path ${target}`)
  const resolved = relative
    ? path.posix.normalize(path.posix.join(path.posix.dirname(from!), target)).replace(/\/$/, "")
    : kind === "Page" ? `pages/${target}` : target
  invariant(isSafeContentPath(resolved), `Invalid ${kind} path ${target}: escapes content or names an invalid target`)
  return resolved
}

// An index starts a nested section; its publication flag governs its subtree.
function collectionDocuments(directory: string): { entries: string[]; sections: string[] } {
  const entries: string[] = []
  const sections: string[] = []
  if (!fs.existsSync(directory)) return { entries, sections }
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name)
    if (item.isDirectory()) {
      if (fs.existsSync(path.join(target, "index.mdx"))) sections.push(target)
      else {
        const nested = collectionDocuments(target)
        entries.push(...nested.entries)
        sections.push(...nested.sections)
      }
    } else if (item.isFile() && /\.mdx?$/.test(item.name) && item.name !== "index.mdx") entries.push(target)
  }
  return { entries, sections }
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

function readCollectionEntries(collection: CollectionName): ContentEntry[] {
  if (!isSafeContentPath(collection) || collection === "pages") return []
  const collectionRoot = path.join(contentRoot, collection)
  const seenSlugs = new Map<string, string>()

  return collectionDocuments(collectionRoot).entries
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
  const source = resolveContentPath("Page", declaration.path, declaration.from)
  const filePath = path.join(contentRoot, `${source}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const { metadata } = readDocument(source)
  return metadata.published ? { path: source, metadata } : null
}

function collectionLabel(collection: CollectionName): string {
  return collection
}

export function resolveCollection(declaration: CollectionDeclaration): ResolvedCollection | null {
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

  const entries = getCollectionEntries(declaration.path).filter((entry) =>
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

export function resolveSections(declarations: SectionDeclaration[]): ResolvedSection[] {
  return declarations.flatMap((section) => {
    if (!isSafeContentPath(section.path)) {
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

  // Only reachable, published documents contribute tags.
  for (const source of discoverSite().sources) {
    const { metadata, body } = readDocument(source)
    normalizeTags(metadata.tags).forEach(addTag)
    getDeclaredProjectTags(body, source).forEach(addTag)
  }

  return Array.from(tags.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function getTaggedPosts(tag: string): ContentEntry[] {
  return getCollectionEntries("posts").filter((entry) => entry.tags.some((entryTag) => entryTag.slug === tag))
}

function readDocument(source: string) {
  const filePath = path.join(contentRoot, `${source}.mdx`)
  invariant(fs.existsSync(filePath), `Missing referenced document ${source}.mdx`)
  const { data, content } = matter(fs.readFileSync(filePath, "utf8"))
  return { metadata: normalizeMetadata(data, filePath), body: content }
}

type Reference = {
  name: "Page" | "Collection"
  path: string
  slot?: "header" | "main" | "footer"
}

// Read declarations without evaluating MDX. Fenced examples create no edges.
function getReferences(body: string, source: string): Reference[] {
  const references: Reference[] = []
  visit(mdxParser.parse(body), (node) => {
    if ((node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") ||
      (node.name !== "Page" && node.name !== "Collection")) return
    invariant(node.attributes.every((attribute) => attribute.type === "mdxJsxAttribute"),
      `${node.name} props must be explicit, without spreads, in ${source}`)
    const componentName = node.name
    function literal(name: string): string | undefined {
      const attributes = node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement"
        ? node.attributes.filter((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name) : []
      invariant(attributes.length <= 1, `Duplicate ${componentName} ${name} in ${source}`)
      const attribute = attributes[0]
      if (!attribute || attribute.type !== "mdxJsxAttribute") return undefined
      const value = attribute.value
      const statement = typeof value === "object" && value ? value.data?.estree?.body[0] : undefined
      const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined
      const result = typeof value === "string" ? value : expression?.type === "Literal" ? expression.value : undefined
      invariant(typeof result === "string", `${componentName} ${name} must be a literal string in ${source}`)
      return result
    }
    const target = literal("path")
    invariant(target, `Missing ${node.name} path in ${source}`)
    const resolved = resolveContentPath(node.name, target, source)
    const slot = literal("slot")
    invariant(!slot || (source === "shell/index" && node.name === "Page" &&
      ["header", "main", "footer"].includes(slot)), `Invalid shell slot in ${source}`)
    references.push({ name: node.name, path: resolved, slot: slot as Reference["slot"] })
  })
  return references
}

export function discoverSite(): SiteGraph {
  const routes = new Map<string, ContentRoute>()
  const sources = new Set<string>()
  const collections = new Set<string>()
  const visiting = new Set<string>()
  const shell = readDocument("shell/index")
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
    const { metadata } = readDocument(source)
    if (metadata.published) routes.set(href, { source, href, metadata, kind })
  }

  function walkDocument(source: string) {
    invariant(!visiting.has(source), `Circular Page reference: ${[...visiting, source].join(" -> ")}`)
    if (sources.has(source)) return
    const { metadata, body } = readDocument(source)
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
    const directory = path.join(contentRoot, collection)
    // Missing folders remain harmless declarations, as before.
    if (!fs.existsSync(directory)) return
    const index = `${collection}/index`
    const { metadata } = readDocument(index)
    if (!metadata.published) return
    collections.add(collection)
    addRoute(index, `/${collection}`, "index")
    walkDocument(index)
    for (const entry of readCollectionEntries(collection)) {
      const source = `${collection}/${entry.slug.join("/")}`
      addRoute(source, entry.href, "entry")
      walkDocument(source)
    }
    // Nested indexes are sections too, with their own publication boundary.
    for (const directoryPath of collectionDocuments(directory).sections) {
      walkCollection(toPosixPath(path.relative(contentRoot, directoryPath)))
    }
  }

  walkDocument("shell/index")
  invariant(routes.has("/"), "The shell main page must be published")
  return { home, routes: [...routes.values()], collections: [...collections], sources: [...sources] }
}

export function getCollectionEntries(collection: CollectionName): ContentEntry[] {
  const site = discoverSite()
  if (!site.collections.includes(collection)) return []
  const published = new Set(site.routes.map((route) => route.href))
  return readCollectionEntries(collection).filter((entry) => published.has(entry.href))
}

export function getContentRoute(slug: string[]): ContentRoute | null {
  const href = slug.length ? `/${slug.join("/")}` : "/"
  return discoverSite().routes.find((route) => route.href === href) ?? null
}

export function getContentStaticParams(): Array<{ slug: string[] }> {
  return discoverSite().routes.filter((route) => route.href !== "/")
    .map((route) => ({ slug: route.href.slice(1).split("/") }))
}

export function resolvePageLink({ path: page, title, from }: PageDeclaration) {
  const source = resolveContentPath("Page", page, from)
  const route = discoverSite().routes.find((candidate) => candidate.source === source)
  return route ? { href: route.href, label: title ?? route.metadata.title } : null
}

export function resolveCollectionLink({ path: collection, title }: CollectionDeclaration) {
  const route = discoverSite().routes.find((candidate) => candidate.href === `/${collection}`)
  return route ? { href: route.href, label: title ?? route.metadata.title } : null
}
