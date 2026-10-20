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

test("public API retains exports, normalized results, excerpts, and missing values", async () => {
  await withContent({ ...baseSite,
    "pages/home.mdx": '<Page path="about" />\n\n<Collection path="posts" />',
    "pages/about.mdx": '---\ntitle: About me\ndescription: Profile\n---\nHello.',
    "pages/draft.mdx": '---\npublished: false\n---\nDraft.',
    "pages/orphan.mdx": '---\ntitle: Unconnected\n---\nOrphan.',
    "posts/index.mdx": '---\ntitle: Journal\n---\n<Collection path="posts" />',
    "posts/default.mdx": '# Heading\n\n<span />\n\nFirst useful line.\nSecond line.',
    "posts/described.mdx": '---\ntitle: Described\ndescription: Authored excerpt\ntags: [Linux]\nstatus: active\n---\nBody.',
    "posts/empty.mdx": '# Heading\n\n<span />',
  }, (content) => {
    assert.deepEqual(Object.keys(content).sort(), [
      "discoverSite", "getCollectionEntries", "getContentRoute", "getContentStaticParams", "getDeclaredProjectTags",
      "getEntry", "getPageMetadata", "getStaticParams", "getTaggedPosts", "getTags", "normalizeTags", "resolveCollection",
      "resolveCollectionLink", "resolveContentPath", "resolvePage", "resolvePageLink", "resolveSections", "slugifyTag",
    ].sort())
    const defaults = { title: "Untitled", description: undefined, date: undefined, tags: undefined,
      status: undefined, published: true, showOnHomepage: true }
    assert.deepEqual(content.getEntry("posts", ["default"]), { collection: "posts", slug: ["default"],
      href: "/posts/default", metadata: defaults, tags: [], excerpt: "First useful line." })
    assert.equal(content.getEntry("posts", ["empty"]).excerpt, "")
    assert.equal(content.getEntry("posts", ["described"]).excerpt, "Authored excerpt")
    assert.deepEqual(content.getPageMetadata("about"), { ...defaults, title: "About me", description: "Profile" })
    assert.deepEqual(content.resolvePage({ path: "about" }), { path: "pages/about", metadata: content.getPageMetadata("about") })
    assert.equal(content.getPageMetadata("orphan").title, "Unconnected")
    assert.deepEqual(content.resolvePage({ path: "orphan" }), { path: "pages/orphan", metadata: content.getPageMetadata("orphan") })
    assert.equal(content.resolvePageLink({ path: "orphan" }), null)
    assert.equal(content.getPageMetadata("draft").published, false)
    assert.equal(content.resolvePage({ path: "missing" }), null)
    assert.equal(content.resolvePage({ path: "draft" }), null)
    assert.throws(() => content.getPageMetadata("missing"), /Missing required page.*missing\.mdx/)
    assert.equal(content.getEntry("posts", ["missing"]), null)
    assert.equal(content.getContentRoute(["missing"]), null)
    assert.equal(content.resolvePageLink({ path: "missing" }), null)
    assert.equal(content.resolveCollectionLink({ path: "missing" }), null)
    assert.equal(content.resolveCollection({ path: "missing" }), null)
    assert.equal(content.resolveCollection({ path: "../posts" }), null)
    assert.deepEqual(content.resolvePageLink({ path: "about" }), { href: "/about", label: "About me" })
    assert.deepEqual(content.resolvePageLink({ path: "about", title: "Profile" }), { href: "/about", label: "Profile" })
    assert.deepEqual(content.resolveCollectionLink({ path: "posts" }), { href: "/posts", label: "Journal" })
    assert.deepEqual(content.resolveCollectionLink({ path: "posts", title: "blog" }), { href: "/posts", label: "blog" })
    assert.deepEqual(content.resolveCollection({ path: "posts", title: "Latest", limit: 1 }), {
      entries: [content.getEntry("posts", ["described"])], title: "Latest", viewAll: { href: "/posts", label: "all posts" },
    })
    assert.deepEqual(content.resolveSections([{ path: "posts", label: "Writing" }, { path: "missing", label: "Missing" },
      { path: "../posts", label: "Invalid" }]), [{ label: "Writing", href: "/posts", count: 3 }])
    assert.deepEqual(content.getStaticParams("posts"), [{ slug: ["described"] }, { slug: ["default"] }, { slug: ["empty"] }])
    assert.deepEqual(content.getContentRoute([]), { source: "pages/home", href: "/", metadata: defaults, kind: "page" })
    assert.deepEqual(content.getContentStaticParams(), [{ slug: ["about"] }, { slug: ["posts"] },
      { slug: ["posts", "described"] }, { slug: ["posts", "default"] }, { slug: ["posts", "empty"] }])
    assert.deepEqual(content.getTaggedPosts("linux").map((entry) => entry.href), ["/posts/described"])
    assert.deepEqual(content.getTaggedPosts("absent"), [])
    assert.equal(content.slugifyTag("  Next.js! "), "next-js")
    assert.deepEqual(content.normalizeTags(undefined), [])
    assert.deepEqual(content.normalizeTags(["!!!", "Linux"]), [{ label: "Linux", slug: "linux", href: "/tags/linux" }])
  })
})

test("lists preserve descending dates, title ties, epoch-zero fallback, and limit validation", async () => {
  await withContent({ ...baseSite,
    "pages/home.mdx": '<Collection path="notes" />',
    "notes/index.mdx": 'Notes.',
    "notes/new-z.mdx": '---\ntitle: Zulu\ndate: "2026-10-20"\n---\nNew.',
    "notes/new-a.mdx": '---\ntitle: Alpha\ndate: "2026-10-20"\n---\nNew.',
    "notes/epoch.mdx": '---\ntitle: Alpha epoch\ndate: "1970-01-01T00:00:00Z"\n---\nEpoch.',
    "notes/undated.mdx": '---\ntitle: Beta undated\n---\nUndated.',
    "notes/old.mdx": '---\ntitle: Ancient\ndate: "1969-12-31"\n---\nOld.',
  }, ({ getCollectionEntries, resolveCollection }) => {
    assert.deepEqual(getCollectionEntries("notes").map((entry) => entry.slug.join("/")),
      ["new-a", "new-z", "epoch", "undated", "old"])
    assert.equal(resolveCollection({ path: "notes", limit: 0 }), null)
    for (const limit of [-1, 1.5, "1", null, NaN, Infinity]) {
      assert.throws(() => resolveCollection({ path: "notes", limit }), /Invalid collection limit for notes/)
    }
    for (const homepage of ["true", 1, null]) {
      assert.throws(() => resolveCollection({ path: "notes", homepage }), /Invalid homepage flag for notes/)
    }
  })
})

test("duplicate references publish once and ordinary links do not activate collections", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/header.mdx": '<Collection path="notes" />\n\n<Collection path="notes" />',
    "pages/home.mdx": '<Collection path="notes" />\n\n[Hidden](/hidden)\n\n<Project href="/hidden" />',
    "hidden/index.mdx": '---\ntags: [hidden]\n---\nHidden.',
    "hidden/example.mdx": 'Hidden entry.',
  }, ({ discoverSite, getTags }) => {
    const site = discoverSite()
    assert.deepEqual(site.collections, ["notes"])
    assert.deepEqual(site.routes.map((route) => route.href), ["/notes", "/notes/later", "/notes/first", "/"])
    assert.equal(site.sources.filter((source) => source === "notes/index").length, 1)
    assert.deepEqual(getTags().map((tag) => tag.slug), ["thinking"])
  })
})

test("an explicitly connected child section publishes beneath a draft parent", async () => {
  await withContent({ ...baseSite,
    "pages/home.mdx": '<Collection path="notes" />\n\n<Collection path="notes/private/public" />',
    "notes/index.mdx": 'Notes.',
    "notes/private/index.mdx": '---\npublished: false\n---\nDraft.',
    "notes/private/secret.mdx": '---\ntags: [secret]\n---\nSecret.',
    "notes/private/public/index.mdx": 'Public child.',
    "notes/private/public/example.mdx": '---\ntags: [visible]\n---\nExample.',
  }, ({ discoverSite, getTags, getCollectionEntries }) => {
    assert.deepEqual(discoverSite().routes.map((route) => route.href),
      ["/", "/notes", "/notes/private/public", "/notes/private/public/example"])
    assert.deepEqual(getCollectionEntries("notes"), [])
    assert.deepEqual(getTags().map((tag) => tag.slug), ["visible"])
  })
})

test("shell validation rejects missing, duplicate, invalid, and unpublished slots", async () => {
  for (const [body, error] of [
    ['<Page path="header" slot="header" />', /requires exactly one Page with slot=main/],
    ['<Page path="home" slot="main" />\n\n<Page path="home" slot="main" />', /Duplicate shell slot main/],
    [shell + '\n\n<Page path="header" slot="header" />', /Duplicate shell slot header/],
    [shell + '\n\n<Page path="footer" slot="footer" />', /Duplicate shell slot footer/],
    [shell + '\n\n<Page path="home" slot="aside" />', /Invalid shell slot in shell\/index/],
    ['---\npublished: false\n---\n' + shell, /shell\/index\.mdx must be published/],
    [shell + '\n\n<Collection path="notes" slot="header" />', /Invalid shell slot in shell\/index/],
  ]) {
    await withContent({ ...baseSite, "shell/index.mdx": body }, ({ discoverSite }) => assert.throws(discoverSite, error))
  }
  await withContent({ ...baseSite, "pages/home.mdx": '---\npublished: false\n---\nHome.' },
    ({ discoverSite }) => assert.throws(discoverSite, /shell main page must be published/))
  await withContent({ ...baseSite, "pages/home.mdx": '<Page path="other" slot="header" />' },
    ({ discoverSite }) => assert.throws(discoverSite, /Invalid shell slot in pages\/home/))
})

test("malformed metadata and unsupported Markdown entries retain contextual errors", async () => {
  for (const [field, value, error] of [
    ["title", '" "', "Invalid title"], ["description", "42", "Invalid description"],
    ["date", '"not-a-date"', "Invalid date"], ["date", "2026-10-20", "Invalid date"],
    ["tags", "[1]", "Invalid tags"], ["status", "false", "Invalid status"],
    ["published", '"false"', "Invalid published flag"],
  ]) {
    await withContent({ ...baseSite, "pages/home.mdx": `---\n${field}: ${value}\n---\nHome.` },
      ({ discoverSite }) => assert.throws(discoverSite, new RegExp(`${error}.*pages/home\\.mdx`)))
  }
  await withContent({ ...baseSite, "pages/home.mdx": '<Collection path="notes" />',
    "notes/index.mdx": 'Notes.', "notes/unsupported.md": 'Legacy.' },
  ({ discoverSite }) => assert.throws(discoverSite, /Unsupported content extension.*unsupported\.md; use \.mdx/))
})

test("literal expressions and inline declarations connect content without evaluating computed paths", async () => {
  await withContent({ ...baseSite, ...notes,
    "pages/home.mdx": '<section>\n<Page path={"about"} />\n</section>\n\nText <Collection path={\'notes\'} /> text.\n\n`<Collection path="hidden" />`',
    "pages/about.mdx": 'About.', "hidden/index.mdx": 'Hidden.',
  }, ({ discoverSite }) => assert.deepEqual(discoverSite().routes.map((route) => route.href),
    ["/", "/about", "/notes", "/notes/later", "/notes/first"]))
  globalThis.contentPathExecuted = false
  try {
    for (const [body, error] of [
      ['<Collection path={(globalThis.contentPathExecuted = true, "notes")} />', /Collection path must be a literal string in pages\/home/],
      ['<Page path="about" path="other" />', /Duplicate Page path in pages\/home/],
      ['<Collection path="notes" path="other" />', /Duplicate Collection path in pages\/home/],
      ['<Page path="about" slot="header" slot="main" />', /Duplicate Page slot in pages\/home/],
      ['<Page />', /Missing Page path in pages\/home/],
    ]) {
      await withContent({ ...baseSite, "pages/home.mdx": body }, ({ discoverSite }) => assert.throws(discoverSite, error))
    }
    assert.equal(globalThis.contentPathExecuted, false)
  } finally {
    delete globalThis.contentPathExecuted
  }
})

test("simultaneously live fixture roots remain independent across A to B to A queries", async () => {
  const fixture = (name) => ({ ...baseSite,
    "pages/home.mdx": `<Collection path="${name}" />`,
    [`${name}/index.mdx`]: name,
    [`${name}/entry.mdx`]: `---\ntitle: ${name}\ntags: [${name}]\n---\n${name}.`,
  })
  await withContent(fixture("alpha"), async (a) => {
    const checkA = () => {
      assert.deepEqual(a.discoverSite().routes.map((route) => route.href), ["/", "/alpha", "/alpha/entry"])
      assert.deepEqual(a.getTags().map((tag) => tag.slug), ["alpha"])
      assert.deepEqual(a.getStaticParams("alpha"), [{ slug: ["entry"] }])
      assert.deepEqual(a.getCollectionEntries("beta"), [])
    }
    checkA()
    await withContent(fixture("beta"), (b) => {
      assert.deepEqual(b.discoverSite().routes.map((route) => route.href), ["/", "/beta", "/beta/entry"])
      assert.deepEqual(b.getTags().map((tag) => tag.slug), ["beta"])
      assert.deepEqual(b.getCollectionEntries("alpha"), [])
      checkA()
    })
    checkA()
  })
})
