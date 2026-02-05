import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'QR Quiz System',
  description: 'Interactive quiz system with QR code access',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="animated-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
