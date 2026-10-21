# Deployment

The site builds to static files in `out/`. The repository configures Cloudflare Worker assets to serve that directory through `wrangler.jsonc`. A small Worker script handles API requests alongside those assets. There is no request-time Next.js server.

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
| Worker entry point | `src/worker.ts` |
| Compatibility date | `2026-07-29` |
| Asset directory | `./out` |
| Asset binding | `ASSETS` |
| Worker-first routes | `/api/*` |
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

## Runtime endpoint and secrets

`GET /api/spotify` currently returns `{"status":"ready"}`. This checks Worker routing only; it does not fetch playback or require credentials. The Worker also handles the Spotify setup routes described below. Other API paths return JSON 404 responses. Page requests continue through the static asset service, including its custom 404 handling.

Test the endpoint with `npx wrangler dev`, then open `/api/spotify` on the local address it prints. `npm run dev` starts Next.js only and does not run the Worker API. A non-publishing bundle check is available with `npx wrangler deploy --dry-run` after building.

After deploying the script to the intended Worker, configure Spotify credentials in that Worker's Settings → Variables and Secrets. Build variables are separate. The public `SPOTIFY_CLIENT_ID` is recorded in Wrangler configuration so later deployments preserve it. Keep the client secret, refresh token, and setup token encrypted as runtime secrets, outside source and Wrangler configuration. For local development, `.dev.vars*` is ignored by Git; no credentials are needed for the readiness endpoint.

### Connect Spotify

This is an owner-only setup flow, separate from the public website. It uses Spotify's [authorization code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow) and requests only `user-read-currently-playing`.

1. In the Spotify app, register exactly `https://kexec.run/api/spotify/callback` as the redirect URI. The Worker uses this same fixed URL for authorization and token exchange. Setup must run on `https://kexec.run`, rather than a preview domain or the Next.js development server.
2. Deploy the Worker to the target serving that domain. Configure `SPOTIFY_CLIENT_SECRET` as an encrypted runtime secret; the client ID is already in `wrangler.jsonc`.
3. Generate a temporary setup key locally with `openssl rand -hex 32`. Add its output as the encrypted runtime secret `SPOTIFY_SETUP_TOKEN`. The Worker requires at least 32 characters and disables setup when the key or client credentials are missing.
4. Open `https://kexec.run/api/spotify/login`, enter that setup key in the form, and authorize your Spotify account. The key is sent in the form body, never in the URL.
5. The callback displays the refresh token as plain text. Save that value as the encrypted runtime secret `SPOTIFY_REFRESH_TOKEN` in the same Worker, then remove `SPOTIFY_SETUP_TOKEN` and close the callback tab. Do not copy tokens into source, issues, or chat.

The setup form uses a same-origin POST. A signed, ten-minute state cookie binds the callback to the browser that started setup; the cookie is Secure, HttpOnly, and cleared on callback responses. Setup responses cannot be cached or framed and do not load external resources. Token exchange errors show a generic message. Only the refresh token is displayed, not the access token or client secret. The Worker does not store tokens automatically or log token responses.

Once `SPOTIFY_REFRESH_TOKEN` exists, both setup routes return 404. To reconnect later, temporarily remove that secret and configure a fresh setup key, then repeat authorization. The `/api/spotify` readiness response and website UI do not use the saved refresh token yet; playback fetching is a separate step.

## Check published URLs

Authored routes come from content connected to `content/shell/index.mdx`. The export includes connected collection indexes and published entries, plus the global tag routes.

For a publication change, check the affected URLs in the new export. Adding a section should add its index and entry pages. Removing its final incoming MDX reference should remove those files and any tag pages used only by that section. A remaining homepage reference keeps the section published.

Deploy the complete new export so hosting also removes obsolete files. Building alone does not change the live site. Unknown URLs should use the generated `404.html`, rendered by `src/app/not-found.tsx`.

## Keep the site static

Filesystem reads belong in `src/lib/content/filesystem.ts` and run during the build. Pages and components use the public API in `src/lib/content.ts`; they do not read content files directly. Keep Next.js page rendering compatible with `output: "export"`: avoid request-time APIs, request-dependent route handlers, ISR, and dynamic image routes inside the Next.js app. Runtime endpoints belong in the separate Worker entry point. Static assets are served from the exported files.
