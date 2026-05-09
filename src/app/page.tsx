import type { Metadata } from "next"
import HomeContent from "../../content/pages/home.mdx"
import Prose from "@/components/ui/Prose"
import { getPageMetadata } from "@/lib/content"

export function generateMetadata(): Metadata {
  const metadata = getPageMetadata("home")

  return {
    title: metadata.title,
    description: metadata.description
  }
}

export default function HomePage() {
  return (
    <main>
      <Prose>
        <HomeContent />
      </Prose>
    </main>
  )
}
