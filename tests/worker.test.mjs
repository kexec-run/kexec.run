import assert from "node:assert/strict"
import test from "node:test"
import worker from "../src/worker.ts"

const noAssets = {
  ASSETS: { fetch() { throw new Error("API requests must not fall through to assets") } },
}

test("Spotify playback endpoint is inactive without credentials and does not read assets", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/spotify?check=1"), noAssets)
  assert.equal(response.status, 200)
  assert.match(response.headers.get("Content-Type"), /application\/json/)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.deepEqual(await response.json(), { isPlaying: false })
})

test("playback endpoint rejects unsupported methods", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/spotify", { method: "POST" }), noAssets)
  assert.equal(response.status, 405)
  assert.equal(response.headers.get("Allow"), "GET")
  assert.deepEqual(await response.json(), { error: "Method not allowed" })
})

test("unknown API paths return JSON 404 instead of a static HTML page", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/missing"), noAssets)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: "Not found" })
})

test("page requests delegate the original request and response to static assets", async () => {
  const request = new Request("https://example.test/notes?example=1")
  const assetResponse = new Response("<h1>notes</h1>", { headers: { "Content-Type": "text/html" } })
  const response = await worker.fetch(request, {
    ASSETS: {
      async fetch(received) {
        assert.equal(received, request)
        return assetResponse
      },
    },
  })
  assert.equal(response, assetResponse)
})

test("missing static pages retain the asset binding's 404 response", async () => {
  const response = await worker.fetch(new Request("https://example.test/missing"), {
    ASSETS: { async fetch() { return new Response("custom 404", { status: 404 }) } },
  })
  assert.equal(response.status, 404)
  assert.equal(await response.text(), "custom 404")
})
