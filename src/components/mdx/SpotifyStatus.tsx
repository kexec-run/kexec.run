"use client"

import { useEffect, useState } from "react"
import type { SpotifyPlayback } from "../../spotify-playback"

export default function SpotifyStatus() {
  const [track, setTrack] = useState<Extract<SpotifyPlayback, { isPlaying: true }> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

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
        if (!disposed) {
          if (valid) setTrack({ isPlaying: true, title: data.title, artist: data.artist, url: data.url })
          setIsPlaying(valid)
        }
      } catch {
        if (!disposed) setIsPlaying(false)
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

  return (
    <div className="spotify-status" role="status" data-playing={isPlaying}>
      <a
        href={isPlaying ? track?.url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-hidden={!isPlaying}
        tabIndex={isPlaying ? undefined : -1}
        aria-label={track ? `Currently listening to ${track.title} by ${track.artist} on Spotify` : undefined}
        title={track ? `${track.title} — ${track.artist}` : undefined}
      >
        <img src="/spotify-icon-white.svg" width="21" height="21" alt="" aria-hidden="true" />
        <span>{track ? `${track.title} — ${track.artist}` : ""}</span>
      </a>
    </div>
  )
}
