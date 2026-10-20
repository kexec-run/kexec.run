# Editing

Content structure and publication are controlled by MDX under `content/`. Adding a section requires no TypeScript edits.

## Shell and navigation

`content/shell/index.mdx` connects global fragments and selects the homepage:

```mdx
<Page path="./header" slot="header" />

<Page path="../pages/home" slot="main" />

<Page path="./footer" slot="footer" />
```

Relative paths resolve from the declaring document: `./header` selects a sibling; `../pages/home` selects the homepage outside the shell folder. Bare `Page` paths still resolve under `content/pages/`, and bare `Collection` paths under `content/`. Paths cannot escape `content/`. Header declarations become navigation links:

```mdx
<Page path="home" title="home" />

<Collection path="notes" title="notes" />

<Collection path="posts" title="blog" />

<Collection path="projects" title="projects" />
```

Edit `content/shell/header.mdx` to change navigation labels and order. `title` is optional and falls back to the destination's frontmatter title. The footer's Markdown links remain in `content/shell/footer.mdx`.

## Add a collection

Create a folder with its own index and entries:

```text
content/
  notes/
    index.mdx
    the-art-of-the-arrow.mdx
```

`content/notes/index.mdx`:

```mdx
---
title: "notes"
description: "Fragments, observations, and ideas in progress."
---

<Collection path="notes" />
```

The index metadata provides the landing page heading, introduction, and SEO description. Its body defines what appears below them, so do not duplicate the heading in the body.

Connect the folder from `header.mdx`:

```mdx
<Collection path="notes" title="notes" />
```

This publishes `/notes` and its published entries. There is no `content/pages/notes.mdx`, collection registry, or notes-specific route code.

A new entry:

```mdx
---
title: "the art of the arrow"
date: "2026-10-20"
description: "On becoming, direction, and the selves we inherit."
---

Your note goes here.
```

Its URL is `/notes/the-art-of-the-arrow`. Use quoted ISO date strings. Entries sort newest first, then by title. The index is excluded from entry listings. Frontmatter descriptions supply entry metadata and excerpts; list presentation remains the responsibility of the renderer.

## Homepage composition

The existing homepage syntax is unchanged:

```mdx
<Page path="about" />

<Collection path="posts" title="blog" limit={3} />

<Collection path="projects" title="projects" limit={4} homepage />
```

Add recent notes there with:

```mdx
<Collection path="notes" title="notes" limit={3} />
```

Homepage references also publish their destinations, independently of navigation. `limit` only limits the displayed list; it does not limit published detail URLs. `homepage` filters entries with `showOnHomepage: false` before applying the limit. Omission of that frontmatter flag means true.

In ordinary content, `Page` includes the named page's content and makes its standalone page reachable. In the header it renders a navigation link. The shell determines this context.

## Draft and undraft

A folder without any connection from the shell's reachable documents is inactive, even if it contains an index referencing itself.

- Connect it with a `Collection` declaration to publish it.
- Remove its final incoming reference to remove its index, detail URLs, and exclusive tags.
- A surviving reference in the homepage, footer, or another reachable document keeps it published.
- Set `published: false` on an entry to exclude that entry.
- Set `published: false` on an index to exclude the collection and stop traversal through it.
- Draft documents do not activate references in their bodies.

Rebuild and deploy for URL changes to take effect. Files stay on disk. Markdown links and `Project href` links do not activate content; use `Page` and `Collection` declarations to establish publication connections.

## Nested hierarchy

```text
content/notes/linux/example.mdx       -> /notes/linux/example
content/notes/topic/index.mdx         -> /notes/topic
content/notes/topic/example.mdx       -> /notes/topic/example
```

Folders without indexes preserve entry slugs. Nested indexes establish sections, discovered when their parent is published. A draft nested index keeps its subtree unpublished unless another reachable declaration connects that subtree explicitly. Each section's collection list excludes its index and entries owned by nested sections.

## Projects and tags

The curated projects index now lives at `content/projects/index.mdx`. Keep using existing `Project` declarations there. Detail pages remain under `content/projects/`. `showOnHomepage: false` still hides a project from the homepage without unpublishing it.

Tags are discovered only from reachable, published frontmatter and literal `Project stack={["python", "javascript"]}` declarations. Do not duplicate metadata to create tag routes. Computed stacks, prop spreads, and conflicting tag slugs fail validation. Code-fence examples create no tags.

Tag detail pages retain their existing posts-only behavior. A tag used only by a project or note has an empty posts state.

## Validation

Use literal paths without extensions or a leading slash. Relative `./` and `../` paths resolve from the declaring file; `.` names its current directory for collection declarations. Both quoted strings and literal string expressions are supported. Computed paths and prop spreads are rejected because route discovery happens before rendering.

A missing collection folder is skipped. Once the folder exists, its index is required. Missing referenced pages, circular page references, duplicate shell slots, URL collisions, and invalid metadata fail with a descriptive content invariant error. Unreferenced folders are not scanned for publication.

```bash
npm test
npm run typecheck
npm run build
```
