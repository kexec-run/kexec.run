import type { ReactNode } from "react"

type ElsewhereProps = {
  children: ReactNode
}

export default function Elsewhere({ children }: ElsewhereProps) {
  return <section className="elsewhere">{children}</section>
}
