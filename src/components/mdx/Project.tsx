import type { ReactNode } from "react"
import ProjectRow from "@/components/content/ProjectRow"
import { normalizeTags } from "@/lib/content"

type ProjectProps = {
  children: ReactNode
  href?: string
  period?: string
  position?: string
  stack?: string[]
  title: string
}

export default function Project({ children, href, period, position, stack = [], title }: ProjectProps) {
  const link = href ? { href, external: /^https?:\/\//.test(href) } : undefined

  return (
    <ProjectRow link={link} period={period} position={position} stack={normalizeTags(stack)} title={title}>
      {children}
    </ProjectRow>
  )
}
