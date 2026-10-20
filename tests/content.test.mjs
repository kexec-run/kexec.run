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
    if (!("shell/index.mdx" in files)) {
      files = { ...files }
      const declarations = []
      for (const collection of ["posts", "projects"]) {
        if (Object.keys(files).some((file) => file.startsWith(`${collection}/`))) {
          files[`${collection}/index.mdx`] ??= `<Collection path="${collection}" />`
          declarations.push(`<Collection path="${collection}" />`)
        }
      }
      for (const file of Object.keys(files).filter((file) => file.startsWith("pages/"))) {
        declarations.push(`<Page path="${file.slice(6, -4)}" />`)
      }
      files["pages/home.mdx"] = declarations.join("\n\n")
      files["shell/index.mdx"] = '<Page path="home" slot="main" />'
    }
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
    "projects/index.mdx": '<Project href="https://example.test" stack={["python", "javascript"]} />',
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
    "projects/index.mdx": '<Project stack={["next-js"]} />',
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

const shell = '<Page path="header" slot="header" />\n\n<Page path="home" slot="main" />\n\n<Page path="footer" slot="footer" />'
const baseSite = {
  "shell/index.mdx": shell,
  "pages/header.mdx": '<Page path="home" title="home" />',
  "pages/home.mdx": '---\ntitle: Home\n---\nWelcome.',
  "pages/footer.mdx": '[email](mailto:example@example.test)',
}
const notes = {
  "notes/index.mdx": '---\ntitle: notes\ndescription: Small observations\n---\n<Collection path="notes" />',
  "notes/first.mdx": '---\ntitle: First\ndate: "2026-10-19"\ntags: [thinking]\n---\nFirst.',
  "notes/later.mdx": '---\ntitle: Later\ndate: "2026-10-20"\n---\nLater.',
  "notes/draft.mdx": '---\npublished: false\ntags: [secret]\n---\n<Collection path="hidden" />',
}

test("header-only collection reference publishes its index and entries, excluding drafts", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/header.mdx": '<Page path="home" title="home" />\n\n<Collection path="notes" title="notes" />',
  }, ({ discoverSite, getCollectionEntries, resolveCollectionLink, getTags }) => {
    const site = discoverSite()
    assert.deepEqual(site.routes.map((route) => route.href).sort(), ["/", "/notes", "/notes/first", "/notes/later"])
    assert.deepEqual(getCollectionEntries("notes").map((entry) => entry.metadata.title), ["Later", "First"])
    assert.deepEqual(resolveCollectionLink({ path: "notes" }), { href: "/notes", label: "notes" })
    assert.equal(site.routes.find((route) => route.href === "/notes").metadata.description, "Small observations")
    assert.deepEqual(getTags().map((tag) => tag.slug), ["thinking"])
    assert(!site.sources.includes("pages/header/index"))
  })
})

test("removing the last reference removes collection routes and tags while files stay on disk", async () => {
  await withContent({ ...baseSite, ...notes }, ({ discoverSite, getContentRoute, getCollectionEntries, getTags }) => {
    assert.deepEqual(discoverSite().routes.map((route) => route.href), ["/"])
    assert.equal(getContentRoute(["notes"]), null)
    assert.equal(getContentRoute(["notes", "first"]), null)
    assert.deepEqual(getCollectionEntries("notes"), [])
    assert.deepEqual(getTags(), [])
  })
})

test("a homepage reference keeps a collection published without a header link", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/home.mdx": '<Collection path="notes" title="notes" limit={1} />',
  }, ({ getContentStaticParams, resolveCollection }) => {
    assert(getContentStaticParams().some(({ slug }) => slug.join("/") === "notes/first"))
    assert.equal(resolveCollection({ path: "notes", limit: 1 }).entries.length, 1)
  })
})

test("unpublished index blocks its entries and outgoing references", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/header.mdx": '<Collection path="notes" />',
    "notes/index.mdx": '---\npublished: false\n---\n<Page path="missing" />',
  }, ({ discoverSite, getTags }) => {
    assert.deepEqual(discoverSite().routes.map((route) => route.href), ["/"])
    assert.deepEqual(getTags(), [])
  })
})

test("nested hierarchy preserves slugs and honors nested section drafts", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/header.mdx": '<Collection path="notes" />',
    "notes/linux/plain.mdx": '---\ntitle: Plain\n---\nNested file.',
    "notes/topic/index.mdx": '<Collection path="notes/topic" />',
    "notes/topic/example.mdx": 'Example.',
    "notes/private/index.mdx": '---\npublished: false\n---\nDraft section.',
    "notes/private/secret.mdx": '---\ntags: [private]\n---\nSecret.',
    "notes/private/deeper/index.mdx": 'Must stay hidden.',
  }, ({ discoverSite, getTags }) => {
    const routes = discoverSite().routes.map((route) => route.href)
    assert(routes.includes("/notes/linux/plain"))
    assert(routes.includes("/notes/topic"))
    assert(routes.includes("/notes/topic/example"))
    assert(!routes.some((route) => route.startsWith("/notes/private")))
    assert(!getTags().some((tag) => tag.slug === "private"))
  })
})

test("fenced declarations and unreachable malformed content cannot activate sections", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/home.mdx": '```mdx\n<Collection path="notes" />\n```',
    "orphan/index.mdx": '<Collection path={unknown} />',
  }, ({ discoverSite }) => assert.deepEqual(discoverSite().routes.map((route) => route.href), ["/"]))
})

test("cycles, missing indexes, dynamic paths, and route collisions fail during discovery", async () => {
  const cases = [
    [{ "pages/home.mdx": '<Page path="other" />', "pages/other.mdx": '<Page path="home" />' }, /Circular Page/],
    [{ "pages/home.mdx": '<Page path="missing" />' }, /Missing referenced document/],
    [{ "pages/home.mdx": '<Collection path="notes" />', "notes/example.mdx": 'Example.' }, /notes\/index/],
    [{ "pages/home.mdx": '<Collection path={unknown} />' }, /literal string/],
    [{ "pages/home.mdx": '<Collection {...props} />' }, /without spreads/],
    [{ ...notes, "pages/home.mdx": '<Collection path="notes" />\n\n<Page path="notes" />', "pages/notes.mdx": 'Collision.' }, /Route collision/],
    [{ "pages/home.mdx": '<Collection path="tags" />', "tags/index.mdx": 'Reserved.' }, /reserved tags/],
    [{ "pages/home.mdx": '<Collection path="../../../outside" />' }, /Invalid Collection path/],
  ]
  for (const [files, error] of cases) {
    await withContent({ ...baseSite, ...files }, ({ discoverSite }) => assert.throws(() => discoverSite(), error))
  }
})

test("shell folder resolves sibling fragments, parent paths, and legacy bare paths", async () => {
  await withContent({
    "shell/index.mdx": '<Page path="./header" slot="header" />\n\n<Page path="../pages/home" slot="main" />\n\n<Page path="./footer" slot="footer" />',
    "shell/header.mdx": '<Page path="../pages/home" title="home" />\n\n<Collection path="../notes" />',
    "shell/footer.mdx": '[email](mailto:example@example.test)',
    "pages/home.mdx": '<Page path="about" />\n\n<Collection path="posts" />',
    "pages/about.mdx": '<Page path="./fragments/bio" />',
    "pages/fragments/bio.mdx": 'Biography.',
    "posts/index.mdx": '<Collection path="." />',
    "posts/example.mdx": 'Post.',
    ...notes,
  }, ({ discoverSite, resolvePage, resolvePageLink, getCollectionEntries, resolveContentPath }) => {
    const site = discoverSite()
    assert.equal(site.home, "pages/home")
    assert(site.sources.includes("shell/header"))
    assert(site.sources.includes("shell/footer"))
    assert(!site.routes.some((route) => route.href.startsWith("/shell")))
    assert(site.routes.some((route) => route.href === "/notes/first"))
    assert(site.routes.some((route) => route.href === "/fragments/bio"))
    assert.equal(getCollectionEntries("posts").length, 1)
    assert.equal(resolvePage({ path: "./header", from: "shell/index" }).path, "shell/header")
    assert.equal(resolvePage({ path: "about" }).path, "pages/about")
    assert.deepEqual(resolvePageLink({ path: "../pages/home", from: "shell/header", title: "home" }),
      { href: "/", label: "home" })
    assert.equal(resolveContentPath("Collection", "./", "notes/index"), "notes")
    assert.throws(() => resolveContentPath("Page", "../../../escape", "shell/header"), /escapes content/)
    assert.throws(() => resolveContentPath("Page", "./header"), /declaring document/)
  })
})
