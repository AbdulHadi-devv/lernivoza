import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/site-nav';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { getTutor } from '@/lib/supabase/tutors';
import {
  formatFee,
  formatGrades,
  formatLocation,
  isUuid,
  modeLabel,
  verificationLabel,
} from '@/lib/supabase/tutors-utils';

async function TutorProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const tutor = await getTutor(id);
  if (!tutor) notFound();

  const verified = tutor.verification_status === 'verified';

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm underline underline-offset-4">
        ← Back to search
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{tutor.full_name}</h1>
          {tutor.qualification && (
            <p className="text-sm text-muted-foreground mt-1">
              {tutor.qualification}
            </p>
          )}
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            verified
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {verificationLabel(tutor.verification_status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Fee</p>
          <p className="text-lg font-semibold mt-1">
            {formatFee(tutor.hourly_fee_pkr)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Teaching</p>
          <p className="text-lg font-semibold mt-1">
            {modeLabel(tutor.teaching_mode)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatLocation(tutor.teaching_mode, tutor.city, tutor.area)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Classes</p>
          <p className="text-lg font-semibold mt-1">
            {formatGrades(tutor.grade_min, tutor.grade_max)}
          </p>
        </div>
      </div>

      {tutor.subjects.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">Subjects</h2>
          <div className="flex flex-wrap gap-2">
            {tutor.subjects.map((s) => (
              <span
                key={s}
                className="rounded bg-muted px-3 py-1 text-sm text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {tutor.bio && (
        <section>
          <h2 className="font-medium mb-2">About</h2>
          <p className="text-sm whitespace-pre-wrap break-words">{tutor.bio}</p>
        </section>
      )}

      {!verified && (
        <p className="text-xs text-muted-foreground">
          This profile has not been checked by an administrator. Qualifications
          and experience are as stated by the tutor.
        </p>
      )}
    </div>
  );
}

export default function TutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <SiteNav />

      <div className="w-full max-w-3xl px-5 py-10 flex-1">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <TutorProfile params={params} />
        </Suspense>
      </div>

      <footer className="w-full flex items-center justify-center border-t text-center text-xs gap-8 py-10">
        <p>Lernivoza · tutor discovery and progress tracking</p>
        <ThemeSwitcher />
      </footer>
    </main>
  );
}