import { Inter } from 'next/font/google'
import '../styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'Battery Vital - Intelligent Battery Safety System',
  description:
    'Real-time battery monitoring with MQTT, MongoDB, and Gemini AI analysis for lithium and lead-acid safety.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg' },
}

export const viewport = {
  themeColor: '#070B15',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
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
