import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';
import { NotificationToast } from '../components/notifications/NotificationToast';
import { NotificationPermissionModal } from '../components/notifications/NotificationPermissionModal';

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
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('watch_theme');
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 dark:bg-[#111217] text-zinc-900 dark:text-slate-100 min-h-screen antialiased selection:bg-rose-500 selection:text-white transition-colors duration-150">
        <ThemeProvider>
          <NotificationProvider>
            {children}
            <NotificationPermissionModal />
            <NotificationToast />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
