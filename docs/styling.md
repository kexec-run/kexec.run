# Styling

CSS controls fonts, colors, spacing, and responsive layout. MDX controls the content and its order. Change the homepage sequence in `content/pages/home.mdx`; change how its rows look in `src/styles/prose.css`.

## Fonts and reading

The site uses **Atkinson Hyperlegible** for body text and **Atkinson Hyperlegible Mono** for code. These fonts were chosen to make reading and scanning faster and easier. Distinguishing similar characters is a priority, especially in technical writing and code.

`src/lib/fonts.ts` loads the fonts with `next/font/google`. The body font uses weights 400 and 700; the code font uses a variable weight. Both use `display: "swap"`.

`src/app/layout.tsx` applies the loaded font classes and CSS variables. `src/styles/theme.css` maps them to `--font-body` and `--font-code`. Normal text uses the body font. Inline code, fenced code, commands, and keyboard input use the code font.

## Visual hierarchy

The homepage shows about, notes, blog, and projects in that order. Notes show at most two entries, blog at most three, and projects at most four. Those choices live in MDX.

| Element | Treatment |
| --- | --- |
| Page heading | Largest heading; an index gets it from frontmatter |
| Section heading | Labels a collection with consistent spacing above its rows |
| Entry title | Accent link, larger than its date and tags |
| Date and tags | Smaller, muted text |
| Footer | Muted text separated from the main content by a border |

Rows use dividers and shared alignment to make lists easy to scan. Notes can omit tags; their dates and titles still provide structure. Titles in rows without tags use the remaining width. Titles in tagged rows have a `36ch` maximum width. Titles wrap instead of being truncated.

Project rows omit dates. Homepage tags use outline-only chips; curated project stack tags use stronger boxes. Tags support the title without competing with it.

At widths of 640px and below, entry rows stack into one column and tags align left. Rows without tags follow the same mobile layout.

## Where styles live

| File | Contents |
| --- | --- |
| `src/styles/theme.css` | Color tokens, font variables, and global defaults |
| `src/styles/prose.css` | Shell, prose, lists, project rows, callouts, and responsive rules |
| `src/styles/code.css` | Inline and fenced code styling |
| `src/app/globals.css` | Imports the style files |

Current color values:

| Use | Value |
| --- | --- |
| Background | `#111` |
| Body text | `#d1d5db` |
| Headings | `#fff` |
| Secondary text | `#818895` |
| Accent | `#ff6b35` |

Keep shared values in CSS tokens. Presentational components provide semantic HTML and class names; MDX declarations do not need styling props to add or reorder content.

## Shell and component boundaries

`content/shell/index.mdx` places the header, current page, and footer. `content/shell/header.mdx` controls navigation labels and order. `content/shell/footer.mdx` controls footer content.

`src/components/layout/SiteShell.tsx` reads the shell through `ContentDocument` and selects how declarations render in each slot. It establishes the header's navigation context. `src/components/layout/Footer.tsx` supplies the footer's HTML wrapper. `layout.tsx` applies fonts and the outer container.

MDX adapters and server components may call the content library to resolve declarations and skip unavailable content. Presentational components such as `EntryList`, `EntryRow`, and `ProjectRow` receive resolved props. They render HTML and CSS hooks without reading files, resolving collections, or constructing tag URLs from raw labels.

## Code blocks and images

Write normal Markdown fences for code. They render as semantic HTML:

```html
<pre><code>...</code></pre>
```

CSS targets `pre`, `pre code`, `code`, `kbd`, and `samp`. Current code styling is CSS-only. If syntax highlighting is added, use the MDX build pipeline so authors can keep using normal fences.

Store original static assets under `public/`. For example, `public/images/example.png` is served at `/images/example.png`. There is no separate `assets/` directory. If image optimization is added, keep originals in `public/` and generate optimized files during the build.

## Error page

`src/app/not-found.tsx` renders the 404 page inside the same shell and prose styles:

```text
404

no file at this path

The filesystem has no content entry for this route.
If this should exist, contact the author.
```
