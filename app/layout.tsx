import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Zen_Kaku_Gothic_New } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-zen-kaku-gothic-new",
  display: "swap",
});
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: '勤務申請',
  description: '勤務時間申請・承認管理システム',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '勤務申請',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#325da8',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${zenKakuGothicNew.variable} ${_geistMono.variable} font-sans antialiased`}>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  )
}
