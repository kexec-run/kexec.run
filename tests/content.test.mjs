import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { getDeclaredProjectTags } from "../src/lib/content.ts"

test("literal project stacks work inside wrappers and inline content", () => {
  const tags = getDeclaredProjectTags(`<section>
<Project stack={['python', "javascript"]} />
</section>

Text <Project stack={["next.js"]} /> text.`, "example.mdx")
  assert.deepEqual(tags.map(({ slug }) => slug), ["python", "javascript", "next-js"])
})

test("code examples and unrelated components do not create project tags", () => {
  const body = '```mdx\n<Project stack={["fake"]} />\n```\n\n' +
    '`<Project stack={["also-fake"]} />`\n\n<Other stack={["ignored"]} />'
  assert.deepEqual(getDeclaredProjectTags(body, "example.mdx"), [])
  assert.deepEqual(getDeclaredProjectTags('<Project title="No stack" />', "example.mdx"), [])
  assert.deepEqual(getDeclaredProjectTags('<Project stack={[]} />', "example.mdx"), [])
})

test("dynamic or invalid stacks fail rather than being evaluated", () => {
  globalThis.projectStackExecuted = false
  for (const stack of [
    '"python"', '{languages}', '{["python", ...other]}', '{[42]}', '{[, "python"]}',
    '{(globalThis.projectStackExecuted = true, ["python"])}',
  ]) {
    assert.throws(() => getDeclaredProjectTags(`<Project stack=${stack} />`, "dynamic.mdx"),
      /Project stack.*dynamic\.mdx/)
  }
  assert.equal(globalThis.projectStackExecuted, false)
  delete globalThis.projectStackExecuted
  assert.throws(() => getDeclaredProjectTags('<Project {...props} />', "spread.mdx"), /without spreads/)
  assert.throws(() => getDeclaredProjectTags('<Project stack={[]} stack={[]} />', "duplicate.mdx"), /Duplicate/)
  assert.throws(() => getDeclaredProjectTags('<Project stack={["next.js", "next-js"]} />', "duplicate.mdx"),
    /Duplicate tag/)
})

async function withContent(files, check) {
  const previous = process.cwd()
  const root = mkdtempSync(path.join(tmpdir(), "portfolio-tags-"))
  try {
    for (const [file, body] of Object.entries(files)) {
      const target = path.join(root, "content", file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, body)
    }
    process.chdir(root)
    // Each fixture gets its own content root; no real portfolio files are changed.
    const content = await import(`../src/lib/content.ts?fixture=${encodeURIComponent(root)}`)
    await check(content)
  } finally {
    process.chdir(previous)
    rmSync(root, { recursive: true, force: true })
  }
}

test("external project tags need no detail page, merge with posts, and skip drafts", async () => {
  await withContent({
    "pages/projects.mdx": '<Project href="https://example.test" stack={["python", "javascript"]} />',
    "posts/example.mdx": '---\ntitle: Example\ntags: [python]\n---\nHello.',
    "pages/draft.mdx": '---\npublished: false\n---\n<Project stack={["draft"]} />',
    "projects/draft.mdx": '---\npublished: false\ntags: [hidden]\n---\n<Project stack={["hidden-stack"]} />',
  }, ({ getTags, getTaggedPosts }) => {
    assert.deepEqual(getTags(), [
      { label: "javascript", slug: "javascript", href: "/tags/javascript" },
      { label: "python", slug: "python", href: "/tags/python" },
    ])
    assert.equal(getTaggedPosts("python").length, 1)
    assert.equal(getTaggedPosts("javascript").length, 0)
  })
})

test("conflicting labels across metadata and declarations fail clearly", async () => {
  await withContent({
    "pages/projects.mdx": '<Project stack={["next-js"]} />',
    "posts/example.mdx": '---\ntags: [next.js]\n---\nHello.',
  }, ({ getTags }) => assert.throws(() => getTags(), /share slug next-js/))
})

test("missing content folders remain valid", async () => {
  await withContent({}, ({ getTags }) => assert.deepEqual(getTags(), []))
})
