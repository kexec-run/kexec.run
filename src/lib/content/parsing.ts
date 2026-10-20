import matter from "gray-matter"
import { createProcessor } from "@mdx-js/mdx"
import { visit } from "unist-util-visit"
import type { ResolvedTag } from "../../types/content"
import { invariant, normalizeTags, resolveContentPath } from "./rules.ts"

const mdxParser = createProcessor()

export function parseFrontmatter(raw: string) {
  return matter(raw)
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

export type ParsedReference = {
  name: "Page" | "Collection"
  path: string
  slot?: string
}

// Read declarations without evaluating MDX. Fenced examples create no edges.
export function* parseReferences(body: string, source: string): Generator<ParsedReference> {
  const nodes: ReturnType<typeof mdxParser.parse>["children"] = []
  visit(mdxParser.parse(body), (node) => {
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") nodes.push(node)
  })
  for (const node of nodes) {
    if ((node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") ||
      (node.name !== "Page" && node.name !== "Collection")) continue
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
    yield { name: node.name, path: resolved, slot }
  }
}
