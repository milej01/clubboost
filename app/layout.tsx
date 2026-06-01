import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'ClubBoost', template: '%s | ClubBoost' },
  description: 'Digital fundraising for sports clubs. Run competitions, collect entries online, and raise more money from your supporters.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
