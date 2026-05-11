# Architecture

This site is a filesystem-driven MDX publishing system built with Next.js App Router, React Server Components, and static export.

## Runtime Baseline

- Next.js `16.2.x`
- React `19`
- TypeScript `5.x`
- App Router only under `src/app`
- Static export with `output: "export"`
- Cloudflare Pages serves the generated static output

## Core Principle

The system is intentionally layered. Each layer owns one class of responsibility, and cross-layer leakage should be treated as an architectural problem.

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| Filesystem | content topology | rendering |
| MDX | declaration and composition | runtime orchestration |
| Parent RSC / adapters | resolution and orchestration | visual language |
| TypeScript lib | parsing and content semantics | UI rendering |
| React renderers | presentation from normalized props | filesystem access |
| CSS | visual language | content semantics |

## Architecture Choices

The site chooses a small filesystem-and-MDX architecture instead of a CMS, database, or runtime markdown engine.

Key choices:

- The filesystem is the topology source.
- MDX is the composition and authored-content surface.
- TypeScript owns content resolution and normalization.
- React renderers consume normalized props only.
- CSS owns visual design.
- Static export is the deployment model.
- Runtime content loading is avoided.

This keeps content git-native and makes deployment a static artifact.

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
content/posts/linux/namespaces.mdx
-> /posts/linux/namespaces
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

## Project Tree

Generated artifacts such as `node_modules/`, `.next/`, `out/`, `.git/`, and `tsconfig.tsbuildinfo` are omitted.

```text
.
├── content/ - authored MDX content root
│   ├── pages/ - authored pages and curated page fragments
│   │   ├── about.mdx - reusable about page content
│   │   ├── home.mdx - homepage composition surface
│   │   └── projects.mdx - curated projects index
│   ├── posts/
│   └── projects/
├── docs/ - project documentation
│   ├── HANDOFF.md - current implementation handoff notes
│   └── arch.md - architecture notes
├── public/ - Next.js static asset input
│   ├── favicon.ico
│   ├── fonts/
│   │   └── .gitkeep
│   └── images/
│       └── .gitkeep
├── src/ - application source code
│   ├── app/ - Next.js App Router routes
│   │   ├── posts/ - post index and detail routes
│   │   │   ├── [...slug]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── projects/ - curated project index and detail routes
│   │   │   ├── [...slug]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── tags/ - global tag index and detail routes
│   │   │   ├── [tag]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── globals.css - global stylesheet imports
│   │   ├── layout.tsx - root shell layout and global nav resolution
│   │   └── page.tsx - homepage route
│   ├── components/ - React components
│   │   ├── content/ - normalized content renderers
│   │   │   ├── CollectionBlock.tsx
│   │   │   ├── EntryList.tsx
│   │   │   ├── EntryRow.tsx
│   │   │   └── ProjectRow.tsx
│   │   ├── layout/ - site shell and layout renderers
│   │   │   ├── Container.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SiteFooter.tsx
│   │   │   └── SiteHeader.tsx
│   │   ├── mdx/ - MDX-facing semantic adapters
│   │   │   ├── CodeBlock.tsx - code block component placeholder
│   │   │   ├── Collection.tsx - resolves collection declarations
│   │   │   ├── Elsewhere.tsx - external links section component
│   │   │   ├── Note.tsx - semantic note block
│   │   │   ├── Page.tsx - includes authored page MDX
│   │   │   ├── Project.tsx - resolves curated project declarations
│   │   │   └── Warning.tsx - semantic warning block
│   │   └── ui/ - small UI primitives
│   │       ├── Divider.tsx - horizontal divider primitive
│   │       ├── Link.tsx - link wrapper placeholder
│   │       └── Prose.tsx - prose wrapper
│   ├── lib/ - content and MDX runtime helpers
│   │   ├── content.ts
│   │   ├── fonts.ts
│   │   └── mdx.ts
│   ├── styles/ - CSS system
│   │   ├── code.css
│   │   ├── prose.css
│   │   └── theme.css
│   └── types/ - shared TypeScript types
│       ├── content.ts
│       └── mdx.d.ts
├── .gitignore - ignored generated/local files
├── mdx-components.tsx - root MDX component provider
├── next-env.d.ts - Next.js generated TypeScript environment declarations
├── next.config.mjs - Next.js and MDX configuration
├── package-lock.json - locked dependency graph
├── package.json - scripts and dependencies
└── tsconfig.json - TypeScript configuration
```

## Data Flow

```text
content/
-> src/lib/content.ts
-> normalized entries / resolved sections
-> parent RSC / declaration adapters
-> pure renderers
-> static output
```

`src/lib/content.ts` is the only place that scans the filesystem. It owns frontmatter parsing, metadata normalization, sorting, route derivation, collection resolution, page resolution, and tag resolution.

## Invariants

These invariants describe the boundaries that should remain true as the site evolves.

- T1: Content topology is defined by files and folders under `content/`; renderers must not encode slug or hierarchy rules.
- T2: Filesystem access is centralized in `src/lib/content.ts`; React renderers and MDX-authored content must not read files directly.
- T3: MDX declares composition intent only; it must not perform sorting, filtering, filesystem traversal, or runtime data loading.
- T4: Parent RSCs and MDX adapters resolve declarations into normalized props before presentational renderers receive them.
- T5: Presentational renderers consume normalized data only; they must not call filesystem helpers or construct route policy from raw content fields.
- T6: Missing, empty, invalid, or unpublished collections are skipped before pure renderers receive props.
- T7: Tag labels, slugs, and global hrefs are normalized in `src/lib/content.ts`; renderers must not construct tag routes.
- T8: Shell navigation is global application shell; homepage MDX controls homepage content composition only.
- T9: Project index ordering is curated by `content/pages/projects.mdx`; project detail topology is defined by `content/projects/**/*.mdx`.
- T10: CSS owns visual language and font application; content and TypeScript layers must not encode visual styling.
- T11: Static export must remain verifiable with `npm run build`; dynamic content patterns are acceptable only when the generated route set is proven at build time.

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
content/pages/projects.mdx
```

`home.mdx` is the homepage composition surface. It can include other pages:

```mdx
<Page path="about" />
```

`projects.mdx` is the curated projects index. It is intentionally authored instead of generated from `content/projects`.

Page inclusion is resolved by `src/components/mdx/Page.tsx`, which validates the requested page path through `src/lib/content.ts` before importing the MDX file.

## Shell Navigation

Header navigation is global application shell, not homepage composition.

- `src/app/layout.tsx` declares global navigation intent.
- `src/app/layout.tsx` resolves collection-backed nav sections before rendering shell components.
- `src/components/layout/SiteHeader.tsx` receives resolved sections only.
- `src/components/layout/Header.tsx` is the pure nav renderer.
- `<Header />` is not registered as an MDX component.

Footer follows the same shell naming:

- `src/components/layout/SiteFooter.tsx` is the shell footer.
- `src/components/layout/Footer.tsx` is the presentational footer renderer.

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

## Styling

CSS owns visual presentation.

Current theme:

- Background: `#111`
- Foreground: `#d1d5db`
- Heading text: `#fff`
- Accent: `#ff6b35`
- Body font: Atkinson Hyperlegible
- Code font: Atkinson Hyperlegible Mono

The typography system switched to Atkinson Hyperlegible and Atkinson Hyperlegible Mono for stronger character differentiation and easier visual parsing.

It prioritizes recognizability and scanability over visual uniformity, reducing fatigue during prolonged reading.

Font loading lives in `src/lib/fonts.ts`. CSS owns where loaded fonts are applied through `--font-body` and `--font-code`.

Theme tokens live in `src/styles/theme.css`. Typography and component classes live in `src/styles/prose.css` and `src/styles/code.css`.

## Static Assets And Output

- `public/` stores original/static site assets and remains the Next.js static asset input.
- `out/` remains generated static export output and can hold optimized generated images later.

Next.js does not allow `public/` as the static export output directory, because `public/` is reserved as an input folder.

## Deployment Constraints

The site is static-first.

Avoid while `output: "export"` is enabled:

- route handlers
- runtime APIs
- dynamic OG routes
- ISR
- server-only request-time filesystem work

Build-time filesystem usage is allowed through `src/lib/content.ts`.

## Verification

Expected checks:

```sh
npm run typecheck
npm run build
```

The static export should generate routes for the home page, posts, nested posts, global tag pages, projects, and nested project detail pages.
