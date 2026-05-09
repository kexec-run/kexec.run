import type { ReactNode } from "react"

type NoteProps = {
  children: ReactNode
}

export default function Note({ children }: NoteProps) {
  return <aside className="note">{children}</aside>
}
