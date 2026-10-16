# kexec-run

Filesystem-driven MDX publishing system built with Next.js App Router, React Server Components, and static export.

## Shape

```text
content/
  pages/     authored pages and page fragments
  posts/     filesystem-driven blog posts
  projects/  project detail pages

src/
  app/        routes and parent RSC orchestration
  lib/        content parsing, resolution, fonts, MDX helpers
  components/ renderers and MDX adapters
  styles/     visual system
```

## Boundaries

- Filesystem owns topology.
- MDX owns declaration and composition.
- Parent RSCs and adapters own resolution.
- `src/lib/content.ts` owns parsing, normalization, sorting, and route derivation.
- React components render normalized props.
- CSS owns visual language.

## Content

Homepage composition lives in `content/pages/home.mdx`.

Posts live under `content/posts` and support nested routes:

```text
content/posts/linux/optimg.mdx
-> /posts/linux/optimg
```

Projects have two surfaces:

- `content/pages/projects.mdx` for the curated project index.
- `content/projects/**/*.mdx` for project detail pages.

The homepage discovers projects from `content/projects/**/*.mdx` and shows their titles as links to the detail pages, alongside their tags. A project added only to the curated index will not appear on the homepage. Blog rows also show dates; homepage project rows omit them.

Set `showOnHomepage: false` in a project's frontmatter to hide it from the homepage only. It defaults to `true` and does not remove the detail page, tags, or curated `/projects` entry. `published: false` still excludes the detail file from collection discovery and generated detail routes.

Footer links live in `content/pages/footer.mdx`.

Tags are discovered from post/project frontmatter and literal `<Project stack={["python", "javascript"]}>` declarations in published MDX under `content/pages`, `content/posts`, and `content/projects`. Stack tags do not require a project detail page. Keep stacks as explicit arrays of strings; computed values and prop spreads are rejected during the build.

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
