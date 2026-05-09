# Codex Handoff

## Goal

Continue the filesystem-driven MDX site implementation without importing the full chat transcript.

## Current State

- Repo: `/Users/rahulpandey/dev/kexec.run`
- Framework baseline: Next.js `16.2.x`, React `19`, TypeScript `5.x`
- Routing model: App Router only under `src/app`
- Deployment model: static export via `output: "export"`
- Content root: `content/`
- Authored MDX under `content/pages`, `content/posts`, and `content/projects`
- No MDX should live under `src/`
- `next-mdx-remote` is not used
- `@next/mdx` is wired through root `mdx-components.tsx`
- `remark-frontmatter` is configured so YAML frontmatter is not rendered as page text

## Architecture Decisions

- Filesystem is the topology layer.
- MDX is declaration/composition only.
- TypeScript/lib owns execution and content resolution.
- React components render normalized props.
- CSS owns presentation.
- Header is global application shell, not homepage composition.
- `home.mdx` controls homepage content composition only.
- Cloudflare Pages serves static output.
- Content components default to React Server Components.
- Avoid `"use client"` unless browser state or browser APIs are genuinely required.
- Avoid Pages Router files: no `pages/`, no `_app.tsx`, no `_document.tsx`.
- Avoid route handlers/runtime APIs while `output: "export"` is enabled.

## Data Flow

```text
content/
-> src/lib/content.ts
-> normalized entries / resolved sections
-> parent RSC / declaration adapters
-> pure renderers
-> static output
```

## Important Boundaries

- `src/lib/content.ts` is the only place that scans the filesystem.
- `src/components/layout/Header.tsx` is a pure renderer.
- `src/app/layout.tsx` resolves global navigation sections and passes them to `SiteHeader`.
- `src/components/layout/SiteHeader.tsx` is a pure shell renderer for resolved sections.
- `src/components/mdx/Collection.tsx` is the MDX-facing declaration adapter for `<Collection />`.
- `src/components/mdx/Page.tsx` is the MDX-facing declaration adapter for including authored pages from `content/pages`.
- `src/components/content/CollectionBlock.tsx` and list/row components are pure renderers.
- List/row renderers receive normalized valid data only.
- Empty or invalid collections are omitted before presentational renderers receive props.
- Header links for empty or missing collections are skipped before reaching shell renderers.

## Files To Load First

- `docs/HANDOFF.md`
- `docs/arch.md`
- `package.json`
- `next.config.mjs`
- `mdx-components.tsx`
- `src/lib/content.ts`
- `src/lib/mdx.ts`
- `src/app/page.tsx`
- `content/pages/home.mdx`
- `src/app/layout.tsx`
- `src/components/layout/SiteHeader.tsx`
- `src/components/layout/Header.tsx`
- `src/components/mdx/Collection.tsx`
- `src/components/mdx/Page.tsx`
- `src/components/content/CollectionBlock.tsx`
- `src/components/content/EntryList.tsx`

## Current Content

- `content/pages/home.mdx`
- `content/pages/about.mdx`
- `content/posts/first-post.mdx`
- `content/posts/linux/namespaces.mdx`
- `content/posts/cloud/firecracker.mdx`
- `content/projects/privledger.mdx`
- `content/projects/infra/unikernel-lab.mdx`

## Verification Already Run

- `npm run typecheck` passes.
- `npm run build` passes with Next.js `16.2.6`.
- Static output is generated in `out/`.
- Generated routes include:
  - `/`
  - `/posts`
  - `/posts/first-post`
  - `/posts/linux/namespaces`
  - `/posts/cloud/firecracker`
  - `/projects`
  - `/projects/privledger`
  - `/projects/infra/unikernel-lab`

## Recent Fix

Global navigation now lives in the application shell:

- `src/app/layout.tsx` declares the home link and collection section intent.
- `src/app/layout.tsx` resolves collection-backed nav sections before rendering shell components.
- `src/components/layout/SiteHeader.tsx` receives resolved sections only.
- `content/pages/home.mdx` owns homepage content composition only.
- `<Header />` is no longer registered as an MDX component; site navigation belongs to the global shell.

Collection rendering was split internally:

- `src/components/mdx/Collection.tsx` remains the public MDX adapter for `<Collection />`.
- `src/components/content/CollectionBlock.tsx` is the pure renderer boundary before `EntryList`.

Page inclusion is supported from MDX:

- `home.mdx` can include authored page documents with declarations such as `<Page path="about" />`.
- `src/components/mdx/Page.tsx` validates the page declaration through `src/lib/content.ts` before importing the MDX page.
- Authored page content stays in `content/pages/*.mdx` so homepage composition does not duplicate page prose.

## Previous Fix

Frontmatter was visible on rendered pages as text like:

```text
title: "Home"
description: "A filesystem-driven MDX site"
```

Fix applied:

- installed `remark-frontmatter`
- added `remarkPlugins: ["remark-frontmatter"]` in `next.config.mjs`
- verified generated HTML no longer contains rendered frontmatter

## Known Notes

- `npm install` reported 2 moderate vulnerabilities in the dependency tree.
- Do not run `npm audit fix --force` unless explicitly requested, because it can introduce breaking dependency changes.
- `tsconfig.tsbuildinfo` may be generated locally and is ignored.

## Next Useful Work

1. Review the browser rendering with `npm run dev`.
2. Tighten typography and layout CSS while preserving the non-carded, typography-first direction.
3. Add sitemap/RSS only after the content model stabilizes.
