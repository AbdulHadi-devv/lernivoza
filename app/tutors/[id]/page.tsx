import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SiteNav } from '@/components/site-nav';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { getSubjects, getTutor } from '@/lib/supabase/tutors';
import { getCurrentProfile } from '@/lib/supabase/profile';
import { getLinksForParent } from '@/lib/supabase/parent-links';
import { EnquiryForm } from '@/components/enquiry-form';
import {
  formatFee,
  formatGrades,
  formatLocation,
  isUuid,
  modeLabel,
  verificationLabel,
} from '@/lib/supabase/tutors-utils';

async function EnquirySection({
  tutorId,
  tutorName,
  tutorSubjects,
}: {
  tutorId: string;
  tutorName: string;
  tutorSubjects: string[];
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <section className="rounded-lg border p-4 flex flex-col gap-2">
        <h2 className="font-medium">Send an enquiry</h2>
        <p className="text-sm text-muted-foreground">
          Sign in or create a parent account to send {tutorName} an enquiry.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/auth/login" className="underline underline-offset-4">
            Sign in
          </Link>
          <Link href="/auth/sign-up" className="underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </section>
    );
  }

  if (profile.role !== 'parent') {
    return (
      <p className="text-sm text-muted-foreground">
        Only parent accounts can send enquiries to tutors.
      </p>
    );
  }

  const links = await getLinksForParent();
  const childOptions = links
    .filter((l) => l.status === 'approved')
    .map((l) => ({ id: l.child_id, name: l.child_name ?? 'Child' }));

  if (childOptions.length === 0) {
    return (
      <section className="rounded-lg border p-4 flex flex-col gap-2">
        <h2 className="font-medium">Send an enquiry</h2>
        <p className="text-sm text-muted-foreground">
          Add your child to your account first. Once they approve the link, you
          can send enquiries for them.
        </p>
        <Link
          href="/parent/children/add"
          className="text-sm underline underline-offset-4 w-fit"
        >
          Add a child →
        </Link>
      </section>
    );
  }

  const allSubjects = await getSubjects();
  const subjectOptions = allSubjects.filter((s) => tutorSubjects.includes(s.name));

  return (
    <EnquiryForm
      teacherId={tutorId}
      teacherName={tutorName}
      childOptions={childOptions}
      subjectOptions={subjectOptions}
    />
  );
}

async function TutorProfile({ params }: { params: Promise<{ id: string }> }) {
  await connection();
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

      <EnquirySection
        tutorId={tutor.id}
        tutorName={tutor.full_name}
        tutorSubjects={tutor.subjects}
      />

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