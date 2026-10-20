# Architecture

The build starts at `content/shell/index.mdx`, follows its MDX declarations, and generates routes for the connected content. Next.js renders those routes to static files in `out/`.

## Who controls what

| Part | Responsibility |
| --- | --- |
| Files and folders | Collection membership, nested paths, and URL slugs |
| MDX | Shell placement, navigation, page content, section order, and publication connections |
| `src/lib/content.ts` | Stable public API and content-root selection |
| `src/lib/content/` | File access, parsing, content rules, entry construction, discovery, and queries |
| Server components and MDX adapters | Turn declarations into resolved data and select the appropriate renderer |
| Presentational components | Render semantic HTML from resolved props |
| CSS | Fonts, colors, spacing, and responsive layout |

Code loads one authored entry point. It supplies reusable components and rules; MDX selects the site's content. There is no collection-name registry or route implementation for each collection.

Code defines the `Page`, `Collection`, and `Project` components, the supported shell slots, and reserved routes. Some presentation conventions also remain in code: project rows omit dates, and tag detail pages list posts only.

## Content library boundaries

Application code and tests continue importing from `src/lib/content.ts`. It keeps the existing exports and captures the `content/` directory from `process.cwd()` when the module loads. It passes that root to internal functions, so changing the working directory later does not redirect an existing import to another site's content.

The implementation lives under `src/lib/content/`:

| Module | Responsibility |
| --- | --- |
| `rules.ts` | Pure path resolution, metadata and tag normalization, excerpt rules, and invariant errors |
| `parsing.ts` | Parse frontmatter and literal MDX declarations without reading files or evaluating expressions |
| `filesystem.ts` | Read documents, check existence, and enumerate entries and nested sections |
| `entries.ts` | Construct normalized entries, apply individual publication flags, and sort entries |
| `discovery.ts` | Follow shell connections, enforce publication and shell-slot rules, and validate routes |
| `queries.ts` | Resolve pages, lists, navigation, routes, and tags using the lower-level modules |

Only `filesystem.ts` accesses the filesystem. Reading a file does not publish it: discovery decides which documents are reachable. Queries use discovery results and the file-reading and entry functions; discovery never calls queries. Internal modules do not import the public entry point or capture their own content roots. There is no shared content cache.

Runtime imports between these TypeScript modules include `.ts` extensions so Node can run the tests with type stripping. TypeScript permits those imports through `allowImportingTsExtensions` with `noEmit`.

## Shell and rendering

`content/shell/index.mdx` contains:

```mdx
<Page path="./header" slot="header" />

<Page path="../pages/home" slot="main" />

<Page path="./footer" slot="footer" />
```

The main slot selects the homepage. At other URLs, that position renders the current route. Exactly one main slot is required. Header and footer slots are optional, and no slot can appear twice. Documents assigned to header and footer slots are shell fragments and do not get standalone routes.

`SiteShell` renders the shell and selects the context for each slot. In the header, `Page` and `Collection` render navigation links. In ordinary content, `Page` includes another document and `Collection` lists entries. A declaration's `title` supplies the navigation label; otherwise the destination's metadata supplies it.

`ContentDocument` imports the MDX source and binds its declarations to that source file. Discovery and rendering use the same `resolveContentPath()` function:

| Declaration | Base directory |
| --- | --- |
| `Page` with a bare path such as `about` | `content/pages/` |
| `Collection` with a bare path such as `notes` | `content/` |
| Either component with `./` or `../` | Directory of the declaring document |

Paths omit the extension and cannot escape `content/`.

## Discover connected content

`discoverSite()` parses MDX into a syntax tree before rendering. It follows literal `Page` and `Collection` paths without evaluating their expressions. Computed paths and prop spreads are rejected. Fenced examples and inline code create no connections.

A collection declaration connects its index and published entries. Discovery follows declarations inside those documents too. A collection index can list its own collection: the list renders links to entries, so it does not recursively render the index.

Only reachable, published documents contribute authored routes and tags. Here, reachable means connected to the shell through `Page` or `Collection` declarations, including entries discovered through a collection. Plain Markdown links and `Project href` values do not publish their targets.

Removing a document's last connection removes its URLs on the next build and deployment. A connection from the homepage, footer, or another published document keeps it published even if its header link is removed.

`published: false` stops traversal through a document. On a collection index, it blocks that collection and its implicitly discovered descendants. A separate explicit declaration can connect a nested section independently. Unconnected files remain on disk as drafts.

## Generate routes from folders

| Source, when connected | URL |
| --- | --- |
| Shell main page | `/` |
| `content/pages/about.mdx` | `/about` |
| `content/notes/index.mdx` | `/notes` |
| `content/notes/example.mdx` | `/notes/example` |
| `content/posts/linux/optimg.mdx` | `/posts/linux/optimg` |
| `content/notes/topic/index.mdx` | `/notes/topic` |
| `content/notes/topic/example.mdx` | `/notes/topic/example` |

Folders without an index preserve nested entry paths. A nested `index.mdx` starts a separate section with its own publication flag. Collection lists stop at those section boundaries; each section lists its own entries. Index files are excluded from entry lists.

`src/app/[...slug]/page.tsx` generates discovered content routes. `src/app/page.tsx` renders the discovered homepage. Tag routes remain separate under `/tags` and `/tags/[tag]`.

## Resolve metadata and lists

Index frontmatter supplies the landing page heading, description, and SEO metadata. Its MDX body supplies the content below them. The projects index uses curated `Project` declarations; notes and posts use `Collection` lists.

Entries sort by date, newest first, then by title. Undated entries sort after dated entries. `published` defaults to true. A declaration using `homepage` excludes entries with `showOnHomepage: false` before applying its limit. That filtering applies to every collection and does not remove detail routes.

Tags come from frontmatter and literal `Project stack` declarations in reachable, published documents, including indexes and shell fragments. The content library normalizes labels, slugs, and links. Conflicting labels with the same slug fail validation. Computed stacks and project prop spreads are rejected; code examples create no tags.

Tag detail pages list posts only. A tag used solely by a project or note has a valid empty posts state. Removing a section's final connection also removes tags used only by that section.

## Validate the build

Missing collection folders are skipped. A referenced folder that exists must have an `index.mdx`. Missing referenced pages, circular page references, malformed metadata, invalid paths, duplicate shell slots, and URL collisions fail with a descriptive content invariant error. `pages` and `shell` are reserved collection roots; `/tags` and its descendants are reserved routes.

Run `npm test`, `npm run typecheck`, and `npm run build` to check the implementation and static export. Tests exercise the public API with temporary content folders, covering publication connections, drafts, nested sections, relative paths, parsing, validation, sorting, and tag discovery. Separate imported roots stay independent when the working directory changes.

Discovery currently rereads reachable documents during the build. If this becomes slow, a build-scoped cache or generated manifest can reduce repeated work. Dynamic MDX imports are checked by the production build.
