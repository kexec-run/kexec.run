import type { ReactNode } from "react"

type WarningProps = {
  children: ReactNode
}

export default function Warning({ children }: WarningProps) {
  return <aside className="warning">{children}</aside>
}
