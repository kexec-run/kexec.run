type FooterProps = {
  text: string
}

export default function Footer({ text }: FooterProps) {
  return <footer className="site-footer">{text}</footer>
}
