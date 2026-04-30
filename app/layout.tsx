import './globals.css';
import type { Metadata } from 'next';
import { Outfit, Open_Sans } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Algent — Tournoi virtuel',
  description: 'Application interne de paris virtuels',
  manifest: '/manifest.webmanifest',
  themeColor: '#275250',
  appleWebApp: {
    capable: true,
    title: 'Algent',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${outfit.variable} ${openSans.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
