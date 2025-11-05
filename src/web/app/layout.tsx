import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DreamUp QA - Browser Game Testing',
  description: 'AI-powered browser game testing and quality assurance platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <main className="container mx-auto py-6 px-4">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}

