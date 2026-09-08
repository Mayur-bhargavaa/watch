import Link from 'next/link';
import { Film } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-cinema-darkest text-slate-100">
      <div className="p-4 bg-cinema-card rounded-full border border-cinema-border">
        <Film className="w-10 h-10 text-cinema-accent" />
      </div>
      <h1 className="text-2xl font-bold">404 — Page Not Found</h1>
      <p className="text-sm text-cinema-muted max-w-sm">
        The virtual cinema room or page you are looking for does not exist or has closed.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-cinema-accent hover:bg-indigo-600 text-xs font-semibold text-white rounded-lg transition"
      >
        Return to Lobby
      </Link>
    </div>
  );
}
