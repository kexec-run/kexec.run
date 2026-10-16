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

test("homepage visibility filters before limits without unpublishing projects", async () => {
  await withContent({
    "projects/hidden.mdx": '---\ntitle: Hidden\ndate: "2026-10-16"\nshowOnHomepage: false\ntags: [hidden-tag]\n---\nHidden.',
    "projects/default.mdx": '---\ntitle: Default\ndate: "2026-10-15"\n---\nDefault.',
    "projects/visible.mdx": '---\ntitle: Visible\ndate: "2026-10-14"\nshowOnHomepage: true\n---\nVisible.',
    "projects/draft.mdx": '---\ntitle: Draft\npublished: false\nshowOnHomepage: true\n---\nDraft.',
  }, ({ resolveCollection, getEntry, getStaticParams, getTags, resolveSections }) => {
    const home = resolveCollection({ path: "projects", homepage: true, limit: 1 })
    assert.deepEqual(home.entries.map((entry) => entry.metadata.title), ["Default"])
    assert.deepEqual(resolveCollection({ path: "projects", homepage: true }).entries.map((entry) => entry.metadata.title),
      ["Default", "Visible"])
    assert.equal(resolveCollection({ path: "projects" }).entries.length, 3)
    assert(getEntry("projects", ["hidden"]))
    assert.equal(getStaticParams("projects").length, 3)
    assert(getTags().some((tag) => tag.slug === "hidden-tag"))
    assert.equal(resolveSections([{ path: "projects", label: "projects" }])[0].count, 3)
  })
})

test("all homepage projects hidden is a valid empty collection", async () => {
  await withContent({
    "projects/hidden.mdx": '---\nshowOnHomepage: false\n---\nHidden.',
  }, ({ resolveCollection, getStaticParams }) => {
    assert.equal(resolveCollection({ path: "projects", homepage: true }), null)
    assert.equal(getStaticParams("projects").length, 1)
  })
})

test("invalid homepage visibility types fail clearly", async () => {
  for (const value of ['"false"', "null", "0", "[]"]) {
    await withContent({
      "projects/invalid.mdx": `---\nshowOnHomepage: ${value}\n---\nInvalid.`,
    }, ({ getCollectionEntries }) => assert.throws(() => getCollectionEntries("projects"), /Invalid showOnHomepage/))
  }
})
