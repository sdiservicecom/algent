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
  title: 'SDI Bet — Le pari du tournoi',
  description:
    'SDI Bet est un site de paris fictif créé pour parier sur les matchs du tournoi de ping-pong.',
  manifest: '/manifest.webmanifest',
  themeColor: '#04100c',
  appleWebApp: {
    capable: true,
    title: 'SDI Bet',
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
