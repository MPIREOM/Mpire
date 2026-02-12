import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'MPIRE — Command Center',
  description: 'Production-grade operations dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  );
}
