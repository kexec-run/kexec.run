"use client"

import { useEffect, useState } from "react"
import type { SpotifyPlayback } from "../../spotify-playback"

export default function SpotifyStatus() {
  const [playback, setPlayback] = useState<SpotifyPlayback>({ isPlaying: false })

  useEffect(() => {
    let disposed = false
    let controller: AbortController | undefined
    async function refresh() {
      if (document.hidden || controller) return
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 12000)
      try {
        const response = await fetch("/api/spotify", { signal: controller.signal, cache: "no-store" })
        const data = response.ok ? await response.json() : null
        const valid = data?.isPlaying === true && typeof data.title === "string" && typeof data.artist === "string" && typeof data.url === "string" && /^https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]{22}$/.test(data.url)
        if (!disposed) setPlayback(valid ? { isPlaying: true, title: data.title, artist: data.artist, url: data.url } : { isPlaying: false })
      } catch {
        if (!disposed) setPlayback({ isPlaying: false })
      } finally {
        window.clearTimeout(timeout)
        controller = undefined
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 30000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", refresh)
      controller?.abort()
    }
  }, [])

  if (!playback.isPlaying) return null
  return (
    <div className="spotify-status" role="status">
      <a href={playback.url} target="_blank" rel="noopener noreferrer" aria-label={`Currently listening to ${playback.title} by ${playback.artist} on Spotify`}>
        <img src="/spotify-icon-white.svg" width="21" height="21" alt="" aria-hidden="true" />
        <span>{playback.title} — {playback.artist}</span>
      </a>
    </div>
  )
}
