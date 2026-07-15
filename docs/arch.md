# Architecture

This site is a filesystem-driven MDX publishing system built with Next.js App Router, React Server Components, and static export.

For operational docs, see:

- [editing.md](./editing.md) - changing content
- [styling.md](./styling.md) - changing visual presentation
- [deployment.md](./deployment.md) - running, verifying, and deploying

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

- The filesystem is the topology source.
- MDX is the composition and authored-content surface.
- TypeScript owns content resolution and normalization.
- React renderers consume normalized props only.
- CSS owns visual design.
- Static export is the deployment model.
- Runtime content loading is avoided.

This keeps content git-native and makes deployment a static artifact.

## Project Tree

Generated artifacts such as `node_modules/`, `.next/`, `out/`, `.git/`, and `tsconfig.tsbuildinfo` are omitted.

```text
.
├── content/ - authored MDX content root
│   ├── pages/ - authored pages and curated page fragments
│   ├── posts/
│   └── projects/
├── docs/ - project documentation
│   ├── arch.md
│   ├── deployment.md
│   ├── editing.md
│   └── styling.md
├── public/ - Next.js static asset input
│   ├── favicon.ico
│   ├── fonts/
│   └── images/
├── src/ - application source code
│   ├── app/ - Next.js App Router routes
│   │   ├── tags/ - global tag index and detail routes
│   ├── components/ - React components
│   ├── lib/ - content, font, and MDX runtime helpers
│   ├── styles/ - CSS system
│   └── types/ - shared TypeScript types
├── mdx-components.tsx - root MDX component provider
├── next.config.mjs - Next.js and MDX configuration
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
- T7a: Tag route generation comes from indexed content metadata, not renderer props.
- T8: Shell navigation is global application shell; homepage MDX controls homepage content composition only.
- T8a: Footer is global shell placement, but footer content may be authored through `content/pages/footer.mdx`; authored footer content must remain declarative and must not own shell mechanics.
- T9: Project index ordering is curated by `content/pages/projects.mdx`; project detail topology is defined by `content/projects/**/*.mdx`.
- T10: CSS owns visual language and font application; content and TypeScript layers must not encode visual styling.
- T11: Static export must remain verifiable with `npm run build`; dynamic content patterns are acceptable only when the generated route set is proven at build time.


## Content Validation

The content resolver enforces data invariants during the build. Invalid metadata, non-boolean publication flags, invalid dates, duplicate route slugs, duplicate tag definitions, conflicting tag slugs, invalid collection limits, unsupported content extensions, and missing required page fragments fail with a descriptive [content invariant] error. Empty or unpublished collections remain valid and are skipped by the MDX adapter.

## Tags

Tags are global metadata, not post-owned routes.

```text
/tags
/tags/[tag]
```

Tag labels, slugs, and hrefs are normalized in `src/lib/content.ts`.

```text
next.js -> { label: "next.js", slug: "next-js", href: "/tags/next-js" }
```

Tag route generation comes from indexed content metadata in `content/posts` and `content/projects`. It does not come from renderer props alone.

`/tags/[tag]` lists posts only. Project stack tags link to global tag pages as shortcuts into related writing. If a tag exists only on a project and no post uses it yet, the tag page remains valid and renders an empty posts state instead of 404.

Unknown tags that are not used anywhere still 404.

## Known Tradeoffs

- `src/lib/content.ts` scans files repeatedly during build. This is acceptable at the current content size; add memoization or a generated manifest only when build time makes it necessary.
- Dynamic MDX imports are accepted because static export is verified with `npm run build`. If route discovery becomes fragile, replace them with a generated import manifest.
- Global tag pages list posts only because the site is writing-centric. Projects remain discoverable through `/projects`, which is small enough to scan directly.
