import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'OddsMatrix | European Top 5 Football Parlay Analysis & Quant Generator',
  description:
    'Advanced sports betting quantitative terminal powered by Bivariate Poisson distributions, +EV market discovery, and Kelly Criterion bankroll management across Premier League, La Liga, Serie A, Bundesliga, and Ligue 1.',
  keywords: [
    'Football Parlay',
    'Expected Value',
    'Poisson Model',
    'Kelly Criterion',
    'Premier League',
    'La Liga',
    'Serie A',
    'Bundesliga',
    'Ligue 1',
    'Sports Analytics'
  ],
  authors: [{ name: 'OddsMatrix Quant Labs' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-terminal-950 text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
