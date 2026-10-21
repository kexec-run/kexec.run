import type { MDXComponents } from "mdx/types"
import Collection from "@/components/mdx/Collection"
import Note from "@/components/mdx/Note"
import Page from "@/components/mdx/Page"
import Project from "@/components/mdx/Project"
import Warning from "@/components/mdx/Warning"
import Navigation from "@/components/mdx/Navigation"
import SpotifyStatus from "@/components/mdx/SpotifyStatus"

export const mdxComponents: MDXComponents = {
  Collection,
  Navigation,
  Note,
  Page,
  Project,
  SpotifyStatus,
  Warning
}
