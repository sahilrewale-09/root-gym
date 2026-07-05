import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Anton, Oswald } from 'next/font/google'
import './globals.css'

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
})

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
})

export const metadata: Metadata = {
  title: 'Root Gym — Your Health, Our Mission | Goregaon West, Mumbai',
  description:
    "Mumbai's most serious gym in Goregaon West. Premium PowerMax equipment, certified trainers, clean facilities, and a friendly community. Memberships from ₹999/month.",
  generator: 'v0.app',
  keywords: [
    'Root Gym',
    'gym in Goregaon West',
    'gym in Mumbai',
    'fitness center Goregaon',
    'PowerMax gym',
    'gym membership Mumbai',
  ],
  openGraph: {
    title: 'Root Gym — Your Health, Our Mission',
    description:
      "Mumbai's most serious gym. Real equipment. Real trainers. Real results.",
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${oswald.variable} ${anton.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
