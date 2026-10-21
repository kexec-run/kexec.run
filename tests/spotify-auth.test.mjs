import assert from "node:assert/strict"
import test from "node:test"
import worker from "../src/worker.ts"

const origin = "https://kexec.run"
const callback = `${origin}/api/spotify/callback`
const env = {
  ASSETS: { fetch() { throw new Error("Auth must not fall through to assets") } },
  SPOTIFY_CLIENT_ID: "test-client",
  SPOTIFY_CLIENT_SECRET: "test-client-secret",
  SPOTIFY_SETUP_TOKEN: "test-setup-token-with-at-least-32-characters",
}

function request(path, options) {
  return new Request(`${origin}/api/spotify/${path}`, options)
}

function loginRequest(token = env.SPOTIFY_SETUP_TOKEN, originHeader = origin) {
  return request("login", {
    method: "POST",
    headers: { Origin: originHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ setup_token: token }),
  })
}

async function begin() {
  const result = await worker.fetch(loginRequest(), env)
  assert.equal(result.status, 303)
  return {
    authorization: new URL(result.headers.get("Location")),
    cookie: result.headers.get("Set-Cookie").split(";")[0],
    headers: result.headers,
  }
}

function callbackRequest(flow, query = {}) {
  const url = new URL(callback)
  url.search = new URLSearchParams({ state: flow.authorization.searchParams.get("state"), code: "test-code", ...query })
  return new Request(url, { headers: { Cookie: flow.cookie } })
}

function assertPrivate(response, referrerPolicy = "no-referrer") {
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.equal(response.headers.get("Referrer-Policy"), referrerPolicy)
  assert.match(response.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/)
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow")
}

test("setup is disabled without every credential and a strong setup key, and closed after refresh token is saved", async () => {
  for (const key of ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_SETUP_TOKEN"]) {
    const result = await worker.fetch(request("login"), { ...env, [key]: undefined })
    assert.equal(result.status, 503)
    assertPrivate(result)
  }
  assert.equal((await worker.fetch(request("login"), { ...env, SPOTIFY_SETUP_TOKEN: "short" })).status, 503)
  for (const path of ["login", "callback"]) {
    const result = await worker.fetch(request(path), { ...env, SPOTIFY_REFRESH_TOKEN: "already-saved" })
    assert.equal(result.status, 404)
    assert.doesNotMatch(await result.text(), /already-saved|test-client-secret/)
  }
})

test("login form contains no credentials and requires the configured HTTPS origin", async () => {
  const result = await worker.fetch(request("login"), env)
  assert.equal(result.status, 200)
  // no-referrer makes browsers send Origin: null on native form POSTs.
  assertPrivate(result, "same-origin")
  assert.match(result.headers.get("Content-Security-Policy"), /form-action 'self' https:\/\/accounts\.spotify\.com;/)
  assert.match(result.headers.get("Content-Type"), /text\/html/)
  const html = await result.text()
  assert.match(html, /method="post"/)
  assert.match(html, /type="password"/)
  for (const secret of Object.values(env).filter(value => typeof value === "string")) assert.ok(!html.includes(secret))
  const wrongHost = await worker.fetch(new Request("https://preview.example/api/spotify/login"), env)
  assert.equal(wrongHost.status, 400)
})

test("only an authenticated same-origin setup form starts authorization", async () => {
  assert.equal((await worker.fetch(loginRequest("incorrect"), env)).status, 403)
  assert.equal((await worker.fetch(loginRequest(undefined, "null"), env)).status, 403)
  assert.equal((await worker.fetch(loginRequest(undefined, "https://attacker.example"), env)).status, 403)
  assert.equal((await worker.fetch(request("login", { method: "POST", body: "setup_token=x" }), env)).status, 403)
  const wrongType = request("login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" })
  assert.equal((await worker.fetch(wrongType, env)).status, 415)
  assert.equal((await worker.fetch(loginRequest("x".repeat(1025)), env)).status, 413)
  const result = await worker.fetch(request("login", { method: "PUT" }), env)
  assert.equal(result.status, 405)
  assert.equal(result.headers.get("Allow"), "GET, POST")
})

test("authorization uses the exact redirect URI, minimal scope, random state, and a signed secure browser cookie", async () => {
  const first = await begin()
  const second = await begin()
  assert.equal(first.authorization.origin, "https://accounts.spotify.com")
  assert.equal(first.authorization.pathname, "/authorize")
  assert.equal(first.authorization.searchParams.get("client_id"), env.SPOTIFY_CLIENT_ID)
  assert.equal(first.authorization.searchParams.get("redirect_uri"), callback)
  assert.equal(first.authorization.searchParams.get("response_type"), "code")
  assert.equal(first.authorization.searchParams.get("scope"), "user-read-currently-playing")
  assert.equal(first.authorization.searchParams.get("show_dialog"), "true")
  assert.notEqual(first.authorization.searchParams.get("state"), second.authorization.searchParams.get("state"))
  assert.match(first.headers.get("Set-Cookie"), /^__Host-spotify-state=.*; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/)
  assertPrivate({ headers: first.headers })
  assert.ok(!first.authorization.href.includes(env.SPOTIFY_SETUP_TOKEN))
  assert.ok(!first.authorization.href.includes(env.SPOTIFY_CLIENT_SECRET))
})

test("callback rejects missing, mismatched, forged and cross-browser state before contacting Spotify", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Must not contact Spotify") })
  const first = await begin()
  const second = await begin()
  const invalid = [
    request("callback?code=x"),
    new Request(callbackRequest(first).url),
    callbackRequest(first, { state: "invalid" }),
    callbackRequest({ ...first, cookie: second.cookie }),
    callbackRequest({ ...first, cookie: first.cookie.slice(0, -1) + (first.cookie.endsWith("a") ? "b" : "a") }),
  ]
  for (const req of invalid) {
    const result = await worker.fetch(req, env)
    assert.equal(result.status, 400)
    assertPrivate(result)
    assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/)
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("callback rejects expired state and state signed with a replaced setup key", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Must not contact Spotify") })
  const flow = await begin()
  const changedKey = await worker.fetch(callbackRequest(flow), { ...env, SPOTIFY_SETUP_TOKEN: "replacement-setup-key-at-least-32-characters" })
  assert.equal(changedKey.status, 400)
  const now = Date.now()
  t.mock.method(Date, "now", () => now + 601000)
  assert.equal((await worker.fetch(callbackRequest(flow), env)).status, 400)
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("callback handles denied consent, missing codes and unsupported methods without token exchange", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Must not contact Spotify") })
  const flow = await begin()
  for (const query of [{ error: "access_denied" }, { code: "" }]) {
    const result = await worker.fetch(callbackRequest(flow, query), env)
    assert.equal(result.status, 400)
    assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/)
  }
  const result = await worker.fetch(request("callback", { method: "POST" }), env)
  assert.equal(result.status, 405)
  assert.equal(result.headers.get("Allow"), "GET")
  assert.equal(globalThis.fetch.mock.callCount(), 0)
})

test("valid callback exchanges the code server-side and exposes only the refresh token in an uncached text response", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://accounts.spotify.com/api/token")
    assert.equal(options.method, "POST")
    assert.equal(options.headers.Authorization, `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`)
    assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded")
    assert.equal(options.redirect, "manual")
    assert.ok(options.signal instanceof AbortSignal)
    assert.deepEqual(Object.fromEntries(options.body), { grant_type: "authorization_code", code: "test-code", redirect_uri: callback })
    return Response.json({ refresh_token: "test-refresh-token", access_token: "test-access-token", scope: "user-read-currently-playing" })
  })
  const flow = await begin()
  const result = await worker.fetch(callbackRequest(flow), env)
  assert.equal(result.status, 200)
  assertPrivate(result)
  assert.match(result.headers.get("Content-Type"), /text\/plain/)
  assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/)
  const text = await result.text()
  assert.match(text, /SPOTIFY_REFRESH_TOKEN:\n\ntest-refresh-token/)
  assert.match(text, /remove SPOTIFY_SETUP_TOKEN/)
  assert.doesNotMatch(text, /test-access-token|test-client-secret|test-setup-token/)
  assert.equal(globalThis.fetch.mock.callCount(), 1)
})

test("upstream failures and malformed token responses never expose upstream data", async t => {
  const flow = await begin()
  for (const reply of [
    () => new Response("sensitive-upstream-data", { status: 400 }),
    () => new Response(null, { status: 302, headers: { Location: "https://unexpected.example" } }),
    () => new Response("sensitive-upstream-data"),
    () => Response.json({ access_token: "sensitive-upstream-data" }),
    () => Response.json({ refresh_token: 123 }),
    () => Response.json(null),
    () => { throw new Error("sensitive-upstream-data") },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", reply)
    const result = await worker.fetch(callbackRequest(flow), env)
    assert.equal(result.status, 502)
    assertPrivate(result)
    assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/)
    assert.doesNotMatch(await result.text(), /sensitive-upstream-data/)
    mock.mock.restore()
  }
})
