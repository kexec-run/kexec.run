import path from "node:path"
import type { ContentMetadata, ResolvedTag } from "../../types/content"

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[content invariant] ${message}`)
  }
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/")
}

export function withoutExtension(value: string): string {
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

export function isSafeContentPath(value: string): boolean {
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

export function normalizeMetadata(data: Record<string, unknown>, source: string): ContentMetadata {
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

export function firstContentLine(body: string): string {
  return (
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("<")) ?? ""
  )
}
