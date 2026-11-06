import Link from 'next/link';
import { Suspense } from 'react';
import { AuthButton } from '@/components/auth-button';

export function SiteNav() {
  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
      <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
        <div className="flex gap-5 items-center">
          <Link href="/" className="font-semibold text-base">
            Lernivoza
          </Link>
          <Link
            href="/protected"
            className="underline-offset-4 hover:underline"
          >
            Dashboard
          </Link>
        </div>
        <Suspense fallback={<span className="text-sm">Loading…</span>}>
          <AuthButton />
        </Suspense>
      </div>
    </nav>
  );
}