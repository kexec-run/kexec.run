# Deployment

The site builds to static files in `out/`. The repository configures Cloudflare Worker assets to serve that directory through `wrangler.jsonc`. There is no request-time Next.js server.

## Build and check

```bash
npm test
npm run typecheck
npm run build
```

Tests check content discovery, relative paths, publication flags, and tags. TypeScript checks component and resolver types. The production build checks MDX imports and exports the generated routes.

`public/` contains source assets. `out/` contains the generated site and is ignored by Git. Next.js reserves `public/` as an input directory, so it cannot be the export destination.

`next-env.d.ts` stays in the repository. Next.js generates it for framework and route type declarations; its development and production import paths can differ. After moving route files, stale generated types under `.next/` may need regeneration with the relevant Next.js command.

## Cloudflare configuration

The checked-in `wrangler.jsonc` sets:

| Setting | Value |
| --- | --- |
| Worker name | `kexec-run-dev` |
| Compatibility date | `2026-07-29` |
| Asset directory | `./out` |
| HTML handling | `auto-trailing-slash` |
| Missing routes | `404-page` |

This is the configured Worker target. The file does not establish which Worker or custom domain serves production. Use the intended target's configuration when deploying.

After building, preview the assets locally:

```bash
npx wrangler dev
```

To publish to the configured Worker:

```bash
npx wrangler deploy
```

The repository already uses `wrangler.jsonc`; a separate `wrangler.toml` is unnecessary. Cloudflare Pages can also serve a static export, but Pages settings are not the checked-in deployment configuration.

## Check published URLs

Authored routes come from content connected to `content/shell/index.mdx`. The export includes connected collection indexes and published entries, plus the global tag routes.

For a publication change, check the affected URLs in the new export. Adding a section should add its index and entry pages. Removing its final incoming MDX reference should remove those files and any tag pages used only by that section. A remaining homepage reference keeps the section published.

Deploy the complete new export so hosting also removes obsolete files. Building alone does not change the live site. Unknown URLs should use the generated `404.html`, rendered by `src/app/not-found.tsx`.

## Keep the site static

Filesystem reads belong in `src/lib/content.ts` and run during the build. Keep page rendering compatible with `output: "export"`: avoid request-time APIs, request-dependent route handlers, ISR, and dynamic image routes. Static assets are served from the exported files.
