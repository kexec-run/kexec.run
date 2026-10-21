import { spotifyAuth, type SpotifyAuthEnv } from "./spotify-auth.ts"

type Env = SpotifyAuthEnv & {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === "/api/spotify/login" || pathname === "/api/spotify/callback") {
      return spotifyAuth(request, env)
    }

    if (pathname === "/api/spotify") {
      if (request.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, {
          status: 405,
          headers: { Allow: "GET" },
        })
      }

      // Readiness only; Spotify authorization and playback fetching come later.
      return Response.json({ status: "ready" }, {
        headers: { "Cache-Control": "no-store" },
      })
    }

    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
}
