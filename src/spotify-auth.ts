export type SpotifyAuthEnv = {
  SPOTIFY_CLIENT_ID?: string
  SPOTIFY_CLIENT_SECRET?: string
  SPOTIFY_SETUP_TOKEN?: string
  SPOTIFY_REFRESH_TOKEN?: string
}

const callbackUrl = "https://kexec.run/api/spotify/callback"
const cookieName = "__Host-spotify-state"
const lifetimeSeconds = 600
const encoder = new TextEncoder()

function response(body: string, status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(extraHeaders)
  headers.set("Cache-Control", "no-store")
  headers.set("Referrer-Policy", "no-referrer")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex, nofollow")
  headers.set("Content-Security-Policy", "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8")
  return new Response(body, { status, headers })
}

function cookie(value: string, maxAge = lifetimeSeconds): string {
  return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")
}

// Hash both inputs before comparing so the setup key's prefix is not exposed by comparison timing.
async function matchesSetupToken(supplied: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])
  return hex(left) === hex(right)
}

async function validState(request: Request, state: string, secret: string): Promise<boolean> {
  if (!/^\d{13}\.[a-f0-9-]{36}$/.test(state)) return false
  const age = Date.now() - Number(state.split(".")[0])
  if (age < 0 || age > lifetimeSeconds * 1000) return false

  const cookies = (request.headers.get("Cookie") ?? "").split(";").map(value => value.trim())
  const stored = cookies.find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (!stored?.startsWith(`${state}.`)) return false
  const signature = stored.slice(state.length + 1)
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const bytes = Uint8Array.from(signature.match(/../g)!, value => parseInt(value, 16))
  return crypto.subtle.verify("HMAC", await signingKey(secret), bytes, encoder.encode(state))
}

export async function spotifyAuth(request: Request, env: SpotifyAuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const isCallback = url.pathname === "/api/spotify/callback"
  const clearCookie: Record<string, string> = isCallback ? { "Set-Cookie": cookie("", 0) } : {}
  const reply = (body: string, status = 200) => response(body, status, clearCookie)

  if (env.SPOTIFY_REFRESH_TOKEN) return reply("Spotify setup is closed.", 404)
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_SETUP_TOKEN || env.SPOTIFY_SETUP_TOKEN.length < 32) {
    return reply("Spotify setup is disabled. Configure the client credentials and a setup token of at least 32 characters.", 503)
  }
  if (url.origin !== new URL(callbackUrl).origin) {
    return reply("Open Spotify setup at https://kexec.run/api/spotify/login.", 400)
  }

  if (!isCallback) {
    if (request.method === "GET") {
      return response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spotify setup</title><h1>Connect your Spotify account</h1><form method="post" action="/api/spotify/login"><label>Setup token <input type="password" name="setup_token" required autocomplete="off" maxlength="512"></label> <button type="submit">Continue to Spotify</button></form></html>`, 200, { "Content-Type": "text/html; charset=utf-8" })
    }
    if (request.method !== "POST") return response("Method not allowed.", 405, { Allow: "GET, POST" })
    if (request.headers.get("Origin") !== url.origin) return reply("Invalid setup request origin.", 403)
    if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") {
      return reply("Expected a setup form.", 415)
    }
    const body = await request.text()
    if (body.length > 1024) return reply("Setup form is too large.", 413)
    const supplied = new URLSearchParams(body).get("setup_token") ?? ""
    if (!await matchesSetupToken(supplied, env.SPOTIFY_SETUP_TOKEN)) return reply("Invalid setup token.", 403)

    const state = `${Date.now()}.${crypto.randomUUID()}`
    const signature = hex(await crypto.subtle.sign("HMAC", await signingKey(env.SPOTIFY_SETUP_TOKEN), encoder.encode(state)))
    const authorize = new URL("https://accounts.spotify.com/authorize")
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: env.SPOTIFY_CLIENT_ID,
      redirect_uri: callbackUrl,
      scope: "user-read-currently-playing",
      state,
      show_dialog: "true",
    }).toString()
    return response("", 303, { Location: authorize.href, "Set-Cookie": cookie(`${state}.${signature}`) })
  }

  if (request.method !== "GET") return response("Method not allowed.", 405, { ...clearCookie, Allow: "GET" })
  const state = url.searchParams.get("state") ?? ""
  if (!await validState(request, state, env.SPOTIFY_SETUP_TOKEN)) return reply("Invalid or expired Spotify state. Start setup again.", 400)
  if (url.searchParams.has("error")) return reply("Spotify authorization was declined or failed. Start setup again.", 400)
  const code = url.searchParams.get("code")
  if (!code) return reply("Missing Spotify authorization code. Start setup again.", 400)

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl }),
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    })
    if (!tokenResponse.ok) return reply("Spotify token exchange failed. Check the app credentials and start setup again.", 502)
    const tokens: unknown = await tokenResponse.json()
    if (!tokens || typeof tokens !== "object" || !("refresh_token" in tokens) || typeof tokens.refresh_token !== "string" || !tokens.refresh_token) {
      return reply("Spotify did not return a refresh token. Start setup again.", 502)
    }
    return reply(`Save the following value as the encrypted Cloudflare runtime secret SPOTIFY_REFRESH_TOKEN:\n\n${tokens.refresh_token}\n\nThen remove SPOTIFY_SETUP_TOKEN to close setup. Close this tab after saving the token.\n`)
  } catch {
    // Do not forward upstream errors or token responses to logs or the browser.
    return reply("Spotify token exchange could not complete. Start setup again.", 502)
  }
}
