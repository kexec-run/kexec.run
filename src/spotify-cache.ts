export type SpotifyEdgeCache = Pick<Cache, "match" | "put">

const browserPolicy = "private, max-age=5, must-revalidate"
const storedAtHeader = "X-Spotify-Cached-At"

export async function playbackCacheKey(credentials: string): Promise<Request> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credentials))
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
  return new Request(`https://kexec.run/__cache/spotify/v1/${key}`)
}

export async function readPlaybackCache(cache: SpotifyEdgeCache | undefined, key: Request): Promise<Response | undefined> {
  if (!cache) return
  try {
    const cached = await cache.match(key)
    if (!cached || cached.status !== 200) return
    const storedAt = Number(cached.headers.get(storedAtHeader))
    const age = Date.now() - storedAt
    // Enforce freshness even if a cache adapter returns an expired entry.
    if (!storedAt || !Number.isFinite(age) || age < 0 || age >= 15000) return
    const response = browserPlaybackResponse(cached)
    response.headers.delete(storedAtHeader)
    response.headers.set("Age", String(Math.floor(age / 1000)))
    return response
  } catch {
    // Cache availability must not prevent a fresh Spotify request.
  }
}

export async function writePlaybackCache(cache: SpotifyEdgeCache | undefined, key: Request, response: Response): Promise<void> {
  if (!cache || response.status !== 200) return
  try {
    const stored = response.clone()
    stored.headers.set("Cache-Control", "public, max-age=15, must-revalidate")
    stored.headers.set(storedAtHeader, String(Date.now()))
    await cache.put(key, stored)
  } catch {
    // A failed cache write can still return the fresh public playback response.
  }
}

export function browserPlaybackResponse(response: Response): Response {
  const result = new Response(response.body, response)
  result.headers.set("Cache-Control", browserPolicy)
  return result
}
