# kexec.run

A personal website built with Next.js App Router, React Server Components, and MDX. Files define the URL hierarchy. MDX connects the pages and collections that get published. The build exports static files to `out/`.

## Run locally

```bash
npm install
npm run dev
```

Before deploying:

```bash
npm test
npm run typecheck
npm run build
```

## Edit the site

Code loads one authored entry point: `content/shell/index.mdx`.

```text
content/
  shell/
    index.mdx     places the header, current page, and footer
    header.mdx    navigation links and their order
    footer.mdx    footer content
  pages/
    home.mdx      homepage sections and their order
    about.mdx     content included on the homepage
  notes/
    index.mdx     notes heading, description, and entry list
    *.mdx         individual notes
  posts/
    index.mdx     blog index
    **/*.mdx     individual posts, including nested folders
  projects/
    index.mdx     curated project list
    **/*.mdx     project detail pages
```

Each collection's `index.mdx` is its landing page and is excluded from entry lists. The homepage currently shows about, two recent notes, three blog posts, then up to four projects.

To add a section, create its folder and index, then connect it from a reachable MDX document:

```mdx
<Collection path="notes" title="notes" />
```

In the header this renders a navigation link. In page content it renders an entry list. Existing bare collection paths start at `content/`; relative paths start at the declaring file. For example, the shell header uses `path="../notes"`.

Only connected, published content gets authored page URLs. Removing its last reference removes those URLs on the next build and deployment. A homepage reference keeps a collection published even after its header link is removed. `published: false` excludes a document explicitly.

See [Editing](docs/editing.md) for adding notes, formatting text, and publishing sections.

## Keep the boundaries clear

MDX chooses what the site contains, how sections connect, and their order. Adding a collection requires no TypeScript registration or new route file.

`src/lib/content.ts` reads files, follows declarations, validates metadata, sorts entries, and determines routes and tags. Server components and MDX adapters use those results. Presentational components render the resolved data; CSS controls their appearance.

Code still defines the available MDX components, shell slots, and reserved routes such as `/tags`. The [architecture doc](docs/arch.md) explains those responsibilities and the publication rules.

## Reading and layout

The site uses **Atkinson Hyperlegible** for text and **Atkinson Hyperlegible Mono** for code. They were chosen to make reading and scanning faster and easier, particularly when distinguishing similar characters.

Headings and entry titles lead the page. Dates and tags use quieter text. Notes show dates and titles without requiring tags; titles use the remaining row width. See [Styling](docs/styling.md) for fonts, colors, and layout rules.

## Deploy

`npm run build` writes the static site to `out/`. The repository's `wrangler.jsonc` configures Cloudflare Worker assets to serve that directory. See [Deployment](docs/deployment.md) for configuration, preview commands, and checks.
