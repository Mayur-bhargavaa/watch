import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SyncCinema — Watch Together, Even When Apart',
  description: 'The real-time social synchronization layer for digital entertainment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-cinema-darkest text-slate-100 min-h-screen antialiased selection:bg-cinema-accent selection:text-white">
        {children}
      </body>
    </html>
  );
}
