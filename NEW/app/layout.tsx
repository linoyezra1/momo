import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Heebo, Rubik } from 'next/font/google'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
})

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'מומו — אישורי הגעה והזמנות דיגיטליות בחינם',
  description:
    'מומו היא מערכת חינמית לאישורי הגעה, הזמנה דיגיטלית, ניהול מוזמנים, סידורי הושבה ודיילת דיגיטלית — הכל במקום אחד, נגיש לכל כיס.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fdfbf7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`light ${heebo.variable} ${rubik.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
