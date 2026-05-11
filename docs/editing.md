# Editing

This doc covers content changes: pages, posts, projects, tags, and footer links.

## Content Topology

The root `content/` directory is the source of authored MDX.

```text
content/
  pages/
  posts/
  projects/
```

No MDX should live under `src/`. The filesystem defines hierarchy, collection membership, slugs, and routes.

Example:

```text
content/posts/linux/optimg.mdx
-> /posts/linux/optimg
```

Collection membership comes from the folder directly under `content/`.

```text
content/posts/...
-> posts collection

content/projects/...
-> projects collection
```

Nested folders are preserved as URL hierarchy. There is no separate route registry to keep in sync.

## Missing Or Empty Content

Missing folders are not treated as fatal errors.

For example, if `content/projects/` does not exist, collection resolution returns no entries instead of throwing. Empty collections and invalid collection declarations are skipped before presentational renderers receive props.

This behavior keeps MDX declarations safe:

```mdx
<Collection path="posts" limit={3} />
```

If the target collection is missing, invalid, empty, or contains only unpublished entries, the adapter returns `null` and the page continues rendering.

Header links for collection-backed sections follow the same rule: empty or missing collections are skipped before shell renderers receive resolved navigation.

## MDX Boundary

MDX is a composition surface. It can declare page sequence and semantic intent, but it should not perform filesystem traversal, sorting, filtering, or data loading.

Supported MDX-facing adapters include:

- `<Collection />` via `src/components/mdx/Collection.tsx`
- `<Page />` via `src/components/mdx/Page.tsx`
- `<Project />` via `src/components/mdx/Project.tsx`
- semantic blocks such as `<Note />` and `<Warning />`

`home.mdx` owns homepage content composition only. It can include authored pages with declarations such as:

```mdx
<Page path="about" />
```

Authored page content stays in `content/pages/*.mdx`, so homepage composition does not duplicate page prose.

## Block-Based Editing

The editing model is block-based at the MDX level.

An authored page is a sequence of blocks:

```mdx
# Heading

Plain prose.

<Page path="about" />

<Collection path="posts" title="blog" limit={3} />

<Project title="Privledger" stack={["mdx", "next.js"]}>
  A short project description.
</Project>
```

Each block expresses intent:

- Markdown headings and paragraphs express document structure.
- `<Page />` includes another authored page.
- `<Collection />` places an automatically resolved collection.
- `<Project />` renders a curated project row.
- `<Note />` and `<Warning />` express semantic callouts.

The block does not own its implementation. The MDX declaration is resolved by TypeScript and rendered by React/CSS.

This means future editing tools can treat MDX as an ordered block list without changing the rendering architecture.

## Pages

`content/pages` contains authored page fragments and curated pages.

Examples:

```text
content/pages/home.mdx
content/pages/about.mdx
content/pages/footer.mdx
content/pages/projects.mdx
```

`home.mdx` is the homepage composition surface. It can include other pages:

```mdx
<Page path="about" />
```

`footer.mdx` is plain Markdown footer content rendered by the global footer shell.

`projects.mdx` is the curated projects index. It is intentionally authored instead of generated from `content/projects`.

Page inclusion is resolved by `src/components/mdx/Page.tsx`, which validates the requested page path through `src/lib/content.ts` before importing the MDX file.

## Collections

Collection declarations are resolved before pure renderers receive props.

- `src/components/mdx/Collection.tsx` is the public MDX adapter for `<Collection />`.
- `src/components/content/CollectionBlock.tsx` is the pure renderer boundary.
- `src/components/content/EntryList.tsx` renders lists of normalized entries.
- `src/components/content/EntryRow.tsx` renders a normalized entry.

Empty, invalid, unpublished, or missing collections are skipped before presentational renderers receive props.

## Posts And Tags

Posts are filesystem-driven under `content/posts`.

Post routes are generated from normalized post content:

```text
/posts
/posts/[...slug]
```

Tags are global metadata, not post-owned routes:

```text
/tags
/tags/[tag]
```

Post tags come from post frontmatter and are normalized into `{ label, slug, href }` objects before renderers receive them.

Examples:

```text
next.js -> { label: "next.js", slug: "next-js", href: "/tags/next-js" }
content-driven -> { label: "content-driven", slug: "content-driven", href: "/tags/content-driven" }
```

The tag index and detail pages are generated from normalized tags across posts and projects. A tag exists if it is used by any indexed content type.

A tag detail page shows posts for that tag, so project stack tags act as shortcuts into related writing. If a tag exists only on a project and no post uses it yet, the tag page remains valid and renders an empty posts state instead of 404.

Tag detail pages intentionally do not list projects right now. The site is writing-centric, and the project index is small enough to scan directly. Project tags point readers toward related writing instead of duplicating the project index through another navigation surface.

Unknown tags that are not used anywhere still 404.

## Projects

The `/projects` index is curated MDX, not an auto-generated project collection.

```text
content/pages/projects.mdx
```

Project rows are authored with `<Project />`. The MDX-facing component resolves project declarations and normalized stack tags before handing them to the pure `ProjectRow` renderer. Stack tags link to global tag routes that show related posts.

Project detail pages may still live under `content/projects` and resolve to nested static routes.

This creates two project surfaces:

- `content/pages/projects.mdx` controls the curated index and ordering.
- `content/projects/**/*.mdx` can hold longer project detail pages.

The curated index avoids over-generalizing project metadata. A project row declares exactly the fields the renderer needs:

```mdx
<Project
  title="Privledger"
  href="/projects/privledger"
  position="creator"
  period="2026 - present"
  stack={["mdx", "next.js", "filesystem"]}
>
  A private ledger experiment for filesystem-first publishing.
</Project>
```

This keeps project-list structure explicit in MDX without making every post/page frontmatter carry project-specific fields.
