# kexec-run

Filesystem-driven MDX publishing system built with Next.js App Router, React Server Components, and static export.

## Shape

```text
content/
  shell/     index.mdx composition, header.mdx, and footer.mdx
  pages/     homepage and included pages
  notes/     notes index and entries
  posts/     blog index and entries
  projects/  curated index and project detail pages

src/
  app/        routes and parent RSC orchestration
  lib/        content parsing, resolution, fonts, MDX helpers
  components/ renderers and MDX adapters
  styles/     visual system
```

## Boundaries

- Filesystem owns topology.
- Only content reachable from `content/shell/index.mdx` is published.
- MDX owns declaration and composition.
- Parent RSCs and adapters own resolution.
- `src/lib/content.ts` owns parsing, normalization, sorting, and route derivation.
- React components render normalized props.
- CSS owns visual language.

## Content

Shell composition lives in `content/shell/index.mdx`; navigation is authored in `content/shell/header.mdx`. Homepage composition stays in `content/pages/home.mdx`.

Connect a new folder with `<Collection path="notes" title="notes" />`. Its `index.mdx` supplies the landing page metadata and composition. Removing its final reachable reference removes its exported URLs on rebuild. No collection registry or per-collection route code is needed.

Posts live under `content/posts` and support nested routes:

```text
content/posts/linux/optimg.mdx
-> /posts/linux/optimg
```

Projects have two surfaces:

- `content/projects/index.mdx` for the curated project index.
- `content/projects/**/*.mdx` for project detail pages.

The homepage discovers projects from `content/projects/**/*.mdx` and shows their titles as links to the detail pages, alongside their tags. A project added only to the curated index will not appear on the homepage. Blog rows also show dates; homepage project rows omit them.

Set `showOnHomepage: false` in a project's frontmatter to hide it from the homepage only. It defaults to `true` and does not remove the detail page, tags, or curated `/projects` entry. `published: false` still excludes the detail file from collection discovery and generated detail routes.

Footer links live in `content/shell/footer.mdx`.

Tags are discovered from reachable, published frontmatter and literal `<Project stack={["python", "javascript"]}>` declarations in reachable MDX, including collection indexes and shell fragments. Stack tags do not require a project detail page. Keep stacks as explicit arrays of strings; computed values and prop spreads are rejected during the build.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

Static export output is generated in `out/`.

## Docs

- [Architecture](docs/arch.md)
- [Editing](docs/editing.md)
- [Styling](docs/styling.md)
- [Deployment](docs/deployment.md)
