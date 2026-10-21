import type { ReactNode } from "react"

export default function Navigation({ children }: { children: ReactNode }) {
  return <nav className="site-nav" aria-label="Primary navigation">{children}</nav>
}
