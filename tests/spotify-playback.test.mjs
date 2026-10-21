import assert from "node:assert/strict"
import test from "node:test"
import { createSpotifyPlayback } from "../src/spotify-playback.ts"

const env = { SPOTIFY_CLIENT_ID: "fake-client", SPOTIFY_CLIENT_SECRET: "fake-secret", SPOTIFY_REFRESH_TOKEN: "fake-refresh" }
const track = {
  is_playing: true, currently_playing_type: "track",
  item: { type: "track", id: "0123456789abcdefghijkl", name: "Test song", artists: [{ name: "First artist" }, { name: "Second artist" }], external_urls: { spotify: "https://untrusted.example" } },
}
const token = () => Response.json({ access_token: "fake-access", expires_in: 3600 })
const expected = { isPlaying: true, title: "Test song", artist: "First artist, Second artist", url: "https://open.spotify.com/track/0123456789abcdefghijkl" }

function mockSpotify(t, playback = () => Response.json(track)) {
  return t.mock.method(globalThis, "fetch", (url, options) => {
    assert.equal(options.redirect, "manual")
    assert.ok(options.signal instanceof AbortSignal)
    if (url === "https://accounts.spotify.com/api/token") {
      assert.equal(options.method, "POST")
      assert.equal(options.headers.Authorization, `Basic ${btoa("fake-client:fake-secret")}`)
      assert.deepEqual(Object.fromEntries(options.body), { grant_type: "refresh_token", refresh_token: "fake-refresh" })
      return token()
    }
    assert.equal(url, "https://api.spotify.com/v1/me/player/currently-playing")
    assert.equal(options.headers.Authorization, "Bearer fake-access")
    return playback()
  })
}

test("missing credentials are inactive without contacting Spotify", async t => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw Error("unexpected network") })
  const handler = createSpotifyPlayback()
  for (const key of Object.keys(env)) {
    const result = await handler({ ...env, [key]: undefined })
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { isPlaying: false })
    assert.equal(result.headers.get("Cache-Control"), "no-store")
  }
  assert.equal(mock.mock.callCount(), 0)
})

test("playing track exposes only normalized metadata and a trusted Spotify URL", async t => {
  mockSpotify(t)
  const result = await createSpotifyPlayback()(env)
  assert.equal(result.status, 200)
  assert.equal(result.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await result.json(), expected)
})

test("paused, empty, episodes, ads, local tracks and malformed metadata are hidden", async t => {
  let data = track
  let empty = false
  mockSpotify(t, () => empty ? new Response(null, { status: 204 }) : Response.json(data))
  for (const value of [
    null, {}, { ...track, is_playing: false }, { ...track, item: null },
    { ...track, currently_playing_type: "episode" }, { ...track, currently_playing_type: "ad" },
    { ...track, item: { ...track.item, type: "episode" } },
    { ...track, item: { ...track.item, id: null } },
    { ...track, item: { ...track.item, id: "unsafe/../path" } },
    { ...track, item: { ...track.item, name: "" } },
    { ...track, item: { ...track.item, artists: [] } },
    { ...track, item: { ...track.item, artists: [{ name: 42 }] } },
  ]) {
    data = value
    assert.deepEqual(await (await createSpotifyPlayback()(env)).json(), { isPlaying: false })
  }
  empty = true
  assert.deepEqual(await (await createSpotifyPlayback()(env)).json(), { isPlaying: false })
})

test("playback requests share a short cache and reuse access tokens until expiry", async t => {
  let now = Date.now()
  t.mock.method(Date, "now", () => now)
  const mock = mockSpotify(t)
  const handler = createSpotifyPlayback()
  const responses = await Promise.all([handler(env), handler(env), handler(env)])
  for (const response of responses) assert.deepEqual(await response.json(), expected)
  assert.equal(mock.mock.callCount(), 2)
  now += 16000
  await handler(env)
  assert.equal(mock.mock.callCount(), 3)
  now += 3600000
  await handler(env)
  assert.equal(mock.mock.callCount(), 5)
})

test("upstream errors and invalid tokens hide playback without disclosing upstream data", async t => {
  for (const failure of [
    () => new Response("private-upstream-data", { status: 403 }),
    () => new Response(null, { status: 302, headers: { Location: "https://unexpected.example" } }),
    () => new Response("private-upstream-data"),
    () => Response.json({ access_token: "private-upstream-data", expires_in: -1 }),
    () => Response.json({ access_token: 12, expires_in: 3600 }),
    () => { throw Error("private-upstream-data") },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", failure)
    const response = await createSpotifyPlayback()(env)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { isPlaying: false })
    mock.mock.restore()
  }
  mockSpotify(t, () => new Response("private-upstream-data", { status: 403 }))
  const response = await createSpotifyPlayback()(env)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { isPlaying: false })
})

test("401 clears the access token and retries once, without an unbounded retry loop", async t => {
  let requests = 0
  const mock = mockSpotify(t, () => ++requests === 1 ? new Response(null, { status: 401 }) : Response.json(track))
  assert.deepEqual(await (await createSpotifyPlayback()(env)).json(), expected)
  assert.equal(mock.mock.callCount(), 4)
  mock.mock.restore()
  const alwaysDenied = mockSpotify(t, () => new Response(null, { status: 401 }))
  assert.equal((await createSpotifyPlayback()(env)).status, 503)
  assert.equal(alwaysDenied.mock.callCount(), 4)
})

test("rate limits hide the status and respect Retry-After before making another upstream request", async t => {
  let now = Date.now()
  t.mock.method(Date, "now", () => now)
  const mock = mockSpotify(t, () => new Response(null, { status: 429, headers: { "Retry-After": "90" } }))
  const handler = createSpotifyPlayback()
  const response = await handler(env)
  assert.equal(response.status, 503)
  assert.equal(response.headers.get("Retry-After"), "90")
  assert.deepEqual(await response.json(), { isPlaying: false })
  now += 31000
  await handler(env)
  assert.equal(mock.mock.callCount(), 2)
  now += 60000
  await handler(env)
  assert.equal(mock.mock.callCount(), 3)
})

test("changing credentials cannot reuse another session's access token or playback, even with an in-flight request", async t => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/api/token")) {
      const first = options.body.get("refresh_token") === "fake-refresh"
      if (first) await wait
      return Response.json({ access_token: first ? "first-access" : "second-access", expires_in: 3600 })
    }
    const first = options.headers.Authorization === "Bearer first-access"
    return Response.json({ ...track, item: { ...track.item, name: first ? "First session" : "Second session" } })
  })
  const handler = createSpotifyPlayback()
  const first = handler(env)
  const second = await handler({ ...env, SPOTIFY_REFRESH_TOKEN: "other-refresh" })
  assert.equal((await second.json()).title, "Second session")
  release()
  assert.equal((await (await first).json()).title, "First session")
  assert.equal((await (await handler({ ...env, SPOTIFY_REFRESH_TOKEN: "other-refresh" })).json()).title, "Second session")
})

test("expired or revoked refresh tokens stop retrying until credentials change", async t => {
  let now = Date.now()
  t.mock.method(Date, "now", () => now)
  const mock = t.mock.method(globalThis, "fetch", () => Response.json({ error: "invalid_grant" }, { status: 400 }))
  const handler = createSpotifyPlayback()
  assert.equal((await handler(env)).status, 503)
  now += 86400000
  assert.equal((await handler(env)).status, 503)
  assert.equal(mock.mock.callCount(), 1)
  await handler({ ...env, SPOTIFY_REFRESH_TOKEN: "replacement" })
  assert.equal(mock.mock.callCount(), 2)
})
