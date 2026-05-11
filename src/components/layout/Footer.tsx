import type { ReactNode } from "react"

type FooterProps = {
  children: ReactNode
}

export default function Footer({ children }: FooterProps) {
  return <footer className="site-footer">{children}</footer>
}
