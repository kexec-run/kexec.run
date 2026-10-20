import fs from "node:fs"
import path from "node:path"
import { parseFrontmatter } from "./parsing.ts"
import { invariant, normalizeMetadata } from "./rules.ts"
import type { PageName } from "../../types/content"

export function contentExists(root: string, relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath))
}

export function readContentFile(root: string, relativePath: string) {
  const filePath = path.join(root, relativePath)
  const { data, content } = parseFrontmatter(fs.readFileSync(filePath, "utf8"))
  return { metadata: normalizeMetadata(data, filePath), body: content }
}

export function readDocument(root: string, source: string) {
  invariant(contentExists(root, `${source}.mdx`), `Missing referenced document ${source}.mdx`)
  return readContentFile(root, `${source}.mdx`)
}

export function readPageMetadata(root: string, page: PageName) {
  const relativePath = path.join("pages", `${page}.mdx`)
  const filePath = path.join(root, relativePath)
  invariant(contentExists(root, relativePath), `Missing required page ${filePath}`)
  return readContentFile(root, relativePath).metadata
}

export function collectionDocuments(root: string, collection: string): { entries: string[]; sections: string[] } {
  return scanDirectory(path.join(root, collection))
}

// An index marks a nested section; callers decide its publication policy.
function scanDirectory(directory: string): { entries: string[]; sections: string[] } {
  const entries: string[] = []
  const sections: string[] = []
  if (!fs.existsSync(directory)) return { entries, sections }
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name)
    if (item.isDirectory()) {
      if (fs.existsSync(path.join(target, "index.mdx"))) sections.push(target)
      else {
        const nested = scanDirectory(target)
        entries.push(...nested.entries)
        sections.push(...nested.sections)
      }
    } else if (item.isFile() && /\.mdx?$/.test(item.name) && item.name !== "index.mdx") entries.push(target)
  }
  return { entries, sections }
}
