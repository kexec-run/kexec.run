import type { Metadata } from "next"
import ProjectsContent from "../../../content/pages/projects.mdx"
import Prose from "@/components/ui/Prose"
import { getPageMetadata } from "@/lib/content"

export function generateMetadata(): Metadata {
  const metadata = getPageMetadata("projects")

  return {
    title: metadata.title,
    description: metadata.description
  }
}

export default function ProjectsPage() {
  return (
    <main>
      <Prose>
        <ProjectsContent />
      </Prose>
    </main>
  )
}
