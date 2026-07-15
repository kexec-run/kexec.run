# Styling

This doc covers visual changes: shell renderers, typography, CSS tokens, and code styling.

## Shell Navigation

Header navigation is global application shell, not homepage composition.

- `src/app/layout.tsx` declares global navigation intent.
- `src/app/layout.tsx` resolves collection-backed nav sections before rendering shell components.
- `src/components/layout/SiteHeader.tsx` receives resolved sections only.
- `src/components/layout/Header.tsx` is the pure nav renderer.
- `<Header />` is not registered as an MDX component.

Footer follows the same shell naming, but its content can be authored:

- `src/components/layout/SiteFooter.tsx` is the shell footer adapter.
- `src/components/layout/Footer.tsx` is the presentational footer renderer.
- `content/pages/footer.mdx` is allowed as authored footer content, because footer copy and links may change without becoming application logic.

## Renderer Boundaries

React renderers own presentation from normalized props.

They may:

- render semantic HTML
- apply class names
- control spacing/layout through CSS hooks
- display normalized entries, sections, projects, and tags

They must not:

- scan the filesystem
- resolve collections
- normalize metadata
- construct tag route policy from raw labels
- perform skip behavior for missing content

## Theme

CSS owns visual presentation.

Current theme:

- Background: `#111`
- Foreground: `#d1d5db`
- Heading text: `#fff`
- Secondary text: `#818895`
- Accent: `#ff6b35`
- Body font: Atkinson Hyperlegible
- Code font: Atkinson Hyperlegible Mono

The typography system uses Atkinson Hyperlegible and Atkinson Hyperlegible Mono for stronger character differentiation and easier visual parsing.

It prioritizes recognizability and scanability over visual uniformity, reducing fatigue during prolonged reading.

Font loading lives in `src/lib/fonts.ts`. CSS owns where loaded fonts are applied through `--font-body` and `--font-code`.

Theme tokens live in `src/styles/theme.css`. Typography and component classes live in `src/styles/prose.css` and `src/styles/code.css`.

List metadata uses the secondary text token so dates, tags, and supporting navigation remain quieter than post and project titles.

Entry titles use a `36ch` reading measure and wrap rather than ellipsize, preserving complete titles in index rows.

Homepage entry tags use outline-only chips. Project index stack tags use slightly stronger boxed chips because they are part of the project row content, not just row metadata.

## Typography

Normal text uses `--font-body`.

Code, commands, keyboard input, and preformatted blocks use `--font-code`.

Fenced code blocks render as semantic Markdown HTML:

```html
<pre><code>...</code></pre>
```

CSS targets `pre`, `pre code`, `code`, `kbd`, and `samp`, so inline code and fenced code blocks share the code font.

## Code Highlighting

The current baseline is CSS-only code styling.

If syntax highlighting is added later, prefer build-time highlighting through MDX/rehype, such as Shiki or `rehype-pretty-code`.

Avoid requiring authors to write custom code components for normal fenced code. Markdown fences should remain the authoring surface.

## Static Assets

Use `public/` for original/static site assets.

`public/images/foo.png` is served as:

```text
/images/foo.png
```

The repo does not keep a separate `assets/` folder. If image optimization is added later, originals can stay in `public/` and generated optimized files can be emitted into the static output workflow.

## Error Pages

`src/app/not-found.tsx` owns the custom 404 surface. It uses the same site shell and prose styling as authored pages, with filesystem-oriented copy:

```text
404

no file at this path

The filesystem has no content entry for this route.
If this should exist, contact the author.
```
