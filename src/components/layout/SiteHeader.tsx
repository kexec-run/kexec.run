import HeaderView from "@/components/layout/Header"
import type { ResolvedSection } from "@/types/content"

type SiteHeaderProps = {
  sections: ResolvedSection[]
}

export default function SiteHeader({ sections }: SiteHeaderProps) {
  return <HeaderView sections={sections} />
}
