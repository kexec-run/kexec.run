# Architecture

The site is a filesystem-driven MDX publishing system built with Next.js App Router, React Server Components, and static export. MDX controls site composition and publication. TypeScript provides discovery, validation, resolution, and rendering.

## Authority and boundaries

| Layer | Owns |
| --- | --- |
| Filesystem | Collection membership, hierarchy, and URL slugs |
| MDX | Shell composition, navigation, references, index content, and publication intent |
| `src/lib/content.ts` | Filesystem access, declaration parsing, reachability, metadata, sorting, and route validation |
| Server components and MDX adapters | Resolve declarations before rendering |
| React renderers and CSS | Presentation and visual language |

`content/shell/index.mdx` is the application's authored entry point. There is no collection-name registry or collection-specific route implementation.

```text
content/shell/index.mdx
  -> shell/header.mdx -> declared pages and collections
  -> pages/home.mdx   -> included pages and collections
  -> shell/footer.mdx -> included pages and collections
```

The shell uses the existing `Page` declaration with a `slot` property:

```mdx
<Page path="./header" slot="header" />

<Page path="../pages/home" slot="main" />

<Page path="./footer" slot="footer" />
```

Relative paths resolve from the declaring document. Bare `Page` paths retain their `content/pages/` base; bare `Collection` paths retain their `content/` base. Discovery and rendering share this resolver, which rejects paths escaping `content/`.

The main slot selects the homepage. At other URLs its position renders the current route. Header and footer slots are optional; exactly one main slot is required. Slot names cannot be duplicated. Header and footer documents are shell fragments, not standalone routes.

Inside the header, `Page` and `Collection` declarations render navigation links. In ordinary content, `Page` includes a document and `Collection` renders entries. The shell explicitly establishes this navigation context. `title` supplies a navigation label; otherwise the destination's metadata supplies it.

## Discovery and publication

Before rendering, `discoverSite()` parses reachable MDX with the MDX syntax tree. It follows explicit, literal `Page` and `Collection` paths from the shell without executing authored expressions. Fenced examples and inline code create no references. Spreads and computed paths are rejected.

A reference to a collection publishes its `index.mdx` and published entries. It also discovers references within those documents. A collection's own index can list that collection without creating a recursive render: the collection adapter renders links, not the index document again.

Only reachable, published documents contribute routes and tags. Files left unconnected on disk are drafts. Removing the last reference removes their generated URLs on the next build and deployment. A reference from the homepage, footer, or another reachable document keeps content published even if its header declaration is removed. Plain Markdown links and `Project href` values are links, not publication declarations.

`published: false` stops traversal through a document. On a collection index it blocks that collection and its implicitly discovered descendants. A separate explicit reference to a nested section can publish that section independently.

Missing collection folders are skipped. An existing referenced folder must contain `index.mdx`. Missing referenced pages, circular page references, invalid declaration paths, malformed metadata, and URL collisions fail the build. `/tags` and its descendants are reserved infrastructure routes.

## Hierarchy and routing

```text
content/pages/home.mdx                -> / (selected by the shell main slot)
content/pages/about.mdx               -> /about when referenced
content/notes/index.mdx               -> /notes when connected
content/notes/example.mdx             -> /notes/example
content/posts/linux/optimg.mdx        -> /posts/linux/optimg
content/notes/topic/index.mdx         -> /notes/topic
content/notes/topic/example.mdx       -> /notes/topic/example
```

Nested directories without an index preserve entry hierarchy. A nested `index.mdx` starts its own section and publication boundary. Index documents are never listed as entries. A collection lists entries up to nested section boundaries; each nested section owns its own list.

`src/app/[...slug]/page.tsx` generates all discovered content URLs. `src/app/page.tsx` renders the discovered root page. `ContentDocument` imports the resolved MDX source; route policy and filesystem access stay in the content library.

## Collections and metadata

Every collection owns its landing page in its folder. Frontmatter supplies the index heading, description, and SEO metadata; the body supplies composition. Posts use an automatic collection list. Projects retain their curated `Project` declarations in `content/projects/index.mdx`.

Entries sort newest first, with title as the tie breaker. `published` defaults to true. `showOnHomepage: false` hides an entry only from declarations using `homepage`; it does not remove the detail route. Homepage filtering happens before the limit and applies to every collection.

## Tags

Global tags come from frontmatter and literal `Project stack` declarations in reachable, published documents, including shell fragments and indexes. Tag labels and slugs are normalized in the content library. Conflicting labels sharing a slug fail clearly. Computed project stacks and prop spreads are rejected; examples in code fences are ignored.

The existing tag detail experience still lists posts. Tags declared only by projects or notes have a valid empty posts state. Removing a section's final reference also removes tags used only by that section.

## Verification and tradeoffs

Run `npm test`, `npm run typecheck`, and `npm run build`. The build generates the static `out/` artifact; publishing changes requires rebuilding and deploying that artifact.

Discovery currently scans reachable documents on demand during the build. This favors correctness without a stale process-wide cache. A generated manifest or build-scoped cache can be added if content growth makes it necessary. Dynamic MDX imports are validated by the production static export.

See [editing.md](./editing.md), [styling.md](./styling.md), and [deployment.md](./deployment.md).
