import type { HTMLAttributes } from "react"

export default function CodeBlock(props: HTMLAttributes<HTMLPreElement>) {
  return <pre {...props} />
}
