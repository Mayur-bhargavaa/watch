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
    <html lang="en">
      <body className="bg-white text-zinc-900 min-h-screen antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
