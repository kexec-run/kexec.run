# Editing

Edit MDX under `content/` to change pages, navigation, and published sections. The shell entry point is `content/shell/index.mdx`.

## Add a note or post

Create an `.mdx` file in an existing collection. For example, `content/notes/example.mdx`:

```mdx
---
title: "Example"
date: "2026-10-20"
published: true
---

First paragraph.

Second paragraph.

> A closing quotation.
```

This becomes `/notes/example` while the notes collection is connected to the shell. The title and date render above the body. `published` defaults to true; set it to false to keep the entry as a draft. Use quoted ISO date strings.

A description and tags are optional:

```yaml
description: "A short summary for metadata and excerpts."
tags: ["linux", "infrastructure"]
```

Entries sort newest first, then by title. Entries without dates follow dated entries. Index files are excluded from lists.

## Format paragraphs and quotes

Write formatted prose in the MDX body. A blank line separates paragraphs. Markdown blockquotes use `>`, as shown above. Use `<br />` for an explicit line break within a paragraph.

Frontmatter descriptions are plain strings. YAML may fold line breaks inside a quoted string, and normal HTML collapses whitespace when it displays the result. Use body paragraphs for a longer introduction.

A collection index automatically displays its frontmatter title and description. Avoid repeating either in the body. The body appears below that introduction.

## Add a collection

Create a folder with an index and entries:

```text
content/notes/
  index.mdx
  example.mdx
```

The index describes the landing page and declares its content:

```mdx
---
title: "notes"
description: "Fragments, observations, and ideas in progress."
---

<Collection path="notes" />
```

Connect it from `content/shell/header.mdx`:

```mdx
<Collection path="../notes" title="notes" />
```

The header now links to `/notes`; discovery publishes the index and its published entries. No TypeScript registration, collection-specific route, or separate file under `content/pages/` is needed. A reference from the homepage or another connected document also publishes the collection.

## Change navigation or shell placement

Navigation lives in `content/shell/header.mdx`:

```mdx
<Page path="../pages/home" title="home" />

<Collection path="../notes" title="notes" />

<Collection path="../posts" title="blog" />

<Collection path="../projects" title="projects" />
```

Reorder declarations to reorder links. `title` overrides the destination's label; omission uses its frontmatter title. Footer content lives in `content/shell/footer.mdx` and supports normal Markdown links.

The shell places those documents around the current page:

```mdx
<Page path="./header" slot="header" />

<Page path="../pages/home" slot="main" />

<Page path="./footer" slot="footer" />
```

The main slot selects the homepage and places the current route at other URLs. Header and footer documents are fragments without standalone URLs. Exactly one main slot is required; slot names cannot repeat.

Relative `./` and `../` paths start at the declaring file. Bare `Page` paths start at `content/pages/`; bare `Collection` paths start at `content/`. A collection path of `.` selects the declaring file's directory. Omit extensions and leading slashes. Paths cannot escape `content/`.

In ordinary page content, `Page` includes another document and `Collection` lists entries. The shell's header context turns the same declarations into navigation links.

## Arrange the homepage

`content/pages/home.mdx` currently contains:

```mdx
<Page path="about" />

<Collection path="notes" title="notes" limit={2} />

<Collection path="posts" title="blog" limit={3} />

<Collection path="projects" title="projects" limit={4} homepage />
```

Change the order or limits here. A limit changes the displayed list, not the number of published detail URLs.

`homepage` filters out entries with `showOnHomepage: false` before applying the limit. Omission of that frontmatter flag means true. Filtering affects only declarations using `homepage`; it does not remove detail pages or tags. Use YAML booleans, not quoted strings.

## Publish or unpublish a section

A folder is inactive until a reachable `Page` or `Collection` declaration connects it to the shell. Its own index referencing itself does not activate it.

Remove the section's last incoming reference to remove its index, entry URLs, and exclusive tags. Check the homepage as well as the header: either connection keeps it published. Files stay on disk. Set `published: false` on an entry to exclude it individually, or on an index to stop discovery through that collection.

Draft documents do not activate declarations in their bodies. Markdown links and `Project href` links do not activate their destinations either.

Rebuild and deploy the complete export for URL changes to take effect.

## Use nested folders

| File | Published URL |
| --- | --- |
| `content/notes/linux/example.mdx` | `/notes/linux/example` |
| `content/notes/topic/index.mdx` | `/notes/topic` |
| `content/notes/topic/example.mdx` | `/notes/topic/example` |

A folder without an index preserves the nested entry path. An index starts a section with its own list and publication flag. Publishing the parent discovers nested sections; setting a nested index to `published: false` blocks discovery through that section. A separate explicit reference can publish a nested section independently.

## Edit projects and tags

`content/projects/index.mdx` contains the curated project list. Keep using `Project` declarations there. Their links can point to GitHub or a local detail page. `content/projects/**/*.mdx` contains the detail entries, excluding indexes; the homepage list comes from those entries. A project declared only in the curated index does not appear in that automatic list.

Tags come from reachable, published frontmatter and literal declarations such as `stack={["python", "javascript"]}` on `Project`. They work without a project detail page. Use explicit string arrays; computed stacks, prop spreads, and conflicting tag slugs fail validation. Code-fence examples do not create tags.

Tag detail pages list posts only. A tag used solely by projects or notes has an empty posts state.

## Check changes

```bash
npm test
npm run typecheck
npm run build
```

A missing collection folder is skipped. An existing referenced collection needs an index. Missing pages, circular references, invalid metadata or paths, duplicate shell slots, and URL collisions fail with a descriptive error. Use literal declaration paths; quoted strings and literal string expressions are supported. Computed paths and prop spreads are rejected during discovery.
