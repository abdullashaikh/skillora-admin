import type { Metadata } from 'next';
import './globals.css';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Skilled Resume — Administration Panel',
  description: 'Administrative management console for AI providers, prompts, scoring, and telemetry.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-xl text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight">Skilled Resume Admin</span>
                <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded-full border border-indigo-800">
                  Control Center
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-medium">
              <a
                href={process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition"
              >
                Go to Main App ↗
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          Protected Administrative Console • Authenticated AES-256-GCM Secret Management
        </footer>
      </body>
    </html>
  );
}
