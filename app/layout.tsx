import type { Metadata } from 'next'
import './globals.css'

// In app/layout.tsx
import { Playfair_Display } from 'next/font/google'
import { Public_Sans } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Tandem Index - Create your index with AI',
  description: 'Professional book indexing with AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${publicSans.variable}`}>
      <body className="bg-gray-100">{children}</body>
    </html>
  )
}
