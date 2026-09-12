import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Watch — Watch Together, Play Together',
  description: 'Watch YouTube in perfect sync, play 2-player games, and video call together — all in one private room. Powered by StitchByte.',
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
