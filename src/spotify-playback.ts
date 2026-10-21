import type { SpotifyAuthEnv } from "./spotify-auth.ts"
import { browserPlaybackResponse, playbackCacheKey, readPlaybackCache, writePlaybackCache, type SpotifyEdgeCache } from "./spotify-cache.ts"

export type SpotifyPlayback =
  | { isPlaying: false }
  | { isPlaying: true; title: string; artist: string; url: string }

type Result = { playback: SpotifyPlayback; status: number; retryAfter?: number; reauthorize?: boolean }
const inactive: SpotifyPlayback = { isPlaying: false }
type PlaybackCache = {
  credentials: string
  accessToken?: string
  expiresAt: number
  cacheKey?: Request
  blocked?: Result
  retryAt: number
  pending?: Promise<Response>
}

function readPlayback(value: unknown): SpotifyPlayback {
  if (!value || typeof value !== "object") return inactive
  const data = value as Record<string, unknown>
  if (data.is_playing !== true || data.currently_playing_type !== "track" || !data.item || typeof data.item !== "object") return inactive
  const item = data.item as Record<string, unknown>
  if (item.type !== "track" || typeof item.id !== "string" || !/^[a-zA-Z0-9]{22}$/.test(item.id) || typeof item.name !== "string" || !item.name.trim()) return inactive
  if (!Array.isArray(item.artists) || !item.artists.length) return inactive
  const names = item.artists.map((artist: unknown) => {
    if (!artist || typeof artist !== "object" || !("name" in artist) || typeof artist.name !== "string" || !artist.name.trim()) return null
    return artist.name
  })
  if (names.some(name => name === null)) return inactive
  return { isPlaying: true, title: item.name, artist: names.join(", "), url: `https://open.spotify.com/track/${item.id}` }
}

// Access tokens and request coalescing stay per Worker instance; playback uses the edge cache.
export function createSpotifyPlayback() {
  let cache: PlaybackCache | undefined

  async function load(env: SpotifyAuthEnv, session: PlaybackCache): Promise<Result> {
    const unavailable = { playback: inactive, status: 503 }
    try {
      // Retry a rejected access token once, in case Spotify revoked it before its expiry.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!session.accessToken || Date.now() >= session.expiresAt) {
          const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN! }),
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          })
          if (tokenResponse.status === 429) return rateLimited(tokenResponse)
          if (tokenResponse.status === 400) {
            const error = await tokenResponse.json() as { error?: unknown } | null
            if (error?.error === "invalid_grant") return { ...unavailable, reauthorize: true }
          }
          if (!tokenResponse.ok) return unavailable
          const token: unknown = await tokenResponse.json()
          if (!token || typeof token !== "object" || !("access_token" in token) || typeof token.access_token !== "string" || !token.access_token || !("expires_in" in token) || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) return unavailable
          session.accessToken = token.access_token
          session.expiresAt = Date.now() + Math.max(0, token.expires_in - 30) * 1000
        }
        const playbackResponse = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        })
        if (playbackResponse.status === 401) {
          session.accessToken = undefined
          continue
        }
        if (playbackResponse.status === 429) return rateLimited(playbackResponse)
        if (playbackResponse.status === 204) return { playback: inactive, status: 200 }
        if (!playbackResponse.ok) return unavailable
        return { playback: readPlayback(await playbackResponse.json()), status: 200 }
      }
    } catch {
      // Network errors and malformed responses hide the indicator without exposing credentials.
    }
    return unavailable
  }

  function rateLimited(response: Response): Result {
    const seconds = Number(response.headers.get("Retry-After"))
    return { playback: inactive, status: 503, retryAfter: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30 }
  }

  return async function spotifyPlayback(env: SpotifyAuthEnv, edgeCache?: SpotifyEdgeCache): Promise<Response> {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) {
      return Response.json(inactive, { headers: { "Cache-Control": "no-store" } })
    }
    const credentials = JSON.stringify([env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET, env.SPOTIFY_REFRESH_TOKEN])
    if (cache?.credentials !== credentials) cache = { credentials, expiresAt: 0, retryAt: 0 }
    const session = cache
    session.cacheKey ??= await playbackCacheKey(credentials)
    if (session.blocked && Date.now() < session.retryAt) return playbackResponse(session.blocked)
    const cached = await readPlaybackCache(edgeCache, session.cacheKey)
    if (cached) return cached

    session.pending ??= (async () => {
      const result = await load(env, session)
      // These are retry guards, never publicly cached error responses.
      if (result.reauthorize || result.retryAfter) {
        session.blocked = result
        session.retryAt = result.reauthorize ? Infinity : Date.now() + result.retryAfter! * 1000
      }
      const response = playbackResponse(result)
      if (result.status === 200) {
        response.headers.set("Date", new Date(Date.now()).toUTCString())
        await writePlaybackCache(edgeCache, session.cacheKey!, response)
        return browserPlaybackResponse(response)
      }
      return response
    })()
    const pending = session.pending
    try {
      return (await pending).clone()
    } finally {
      if (session.pending === pending) session.pending = undefined
    }
  }
}

function playbackResponse(result: Result): Response {
  return Response.json(result.playback, {
    status: result.status,
    headers: { "Cache-Control": "no-store", ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}) },
  })
}
