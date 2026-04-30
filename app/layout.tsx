import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Algent — Tournoi virtuel',
  description: 'Application interne de paris virtuels',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
