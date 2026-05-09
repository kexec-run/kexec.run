import type { ReactNode } from "react"

type ProseProps = {
  children: ReactNode
}

export default function Prose({ children }: ProseProps) {
  return <div className="prose">{children}</div>
}
