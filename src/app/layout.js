import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  title: 'Battery Vital — Mission Control Battery Telemetry & Safety System',
  description:
    'Industrial-grade real-time battery vital monitoring, hardware controls, edge safety interlocks, and AI analytics.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg' },
}

export const viewport = {
  themeColor: '#0B0E12',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div className="auroraBg">
          <div className="blob blob1" />
          <div className="blob blob2" />
          <div className="blob blob3" />
          <div className="blob blob4" />
          <div className="gridOverlay" />
        </div>
        {children}
      </body>
    </html>
  )
}
