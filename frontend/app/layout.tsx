import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'TON Price Dashboard',
  description: 'Real-time TON price dashboard for multiple exchanges',
  icons: {
    icon: '/toncoin.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode; }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
