import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { SiteNav } from '@/components/site-nav';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import {
  getListedCities,
  getSubjects,
  searchTutors,
} from '@/lib/supabase/tutors';
import {
  GRADES,
  formatFee,
  formatGrades,
  formatLocation,
  modeLabel,
  parseTutorFilters,
  verificationLabel,
  type RawSearchParams,
  type TutorCard,
} from '@/lib/supabase/tutors-utils';

const fieldClass =
  'w-full rounded border px-3 py-2 text-sm bg-background text-foreground';

function TutorResultCard({ tutor }: { tutor: TutorCard }) {
  const verified = tutor.verification_status === 'verified';
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-lg truncate">{tutor.full_name}</h3>
          {tutor.qualification && (
            <p className="text-xs text-muted-foreground truncate">
              {tutor.qualification}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
            verified
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {verificationLabel(tutor.verification_status)}
        </span>
      </div>

      {tutor.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tutor.subjects.map((s) => (
            <span
              key={s}
              className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {tutor.bio && (
        <p className="text-sm text-muted-foreground line-clamp-3">{tutor.bio}</p>
      )}

      <div className="text-sm grid gap-1">
        <p className="font-medium">{formatFee(tutor.hourly_fee_pkr)}</p>
        <p className="text-muted-foreground">
          {modeLabel(tutor.teaching_mode)} ·{' '}
          {formatGrades(tutor.grade_min, tutor.grade_max)}
        </p>
        <p className="text-muted-foreground">
          {formatLocation(tutor.teaching_mode, tutor.city, tutor.area)}
        </p>
      </div>

      <div className="mt-auto">
        <Button asChild size="sm">
          <Link href={`/tutors/${tutor.id}`}>View profile</Link>
        </Button>
      </div>
    </div>
  );
}

async function SearchSection({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await connection();
  const raw = await searchParams;
  const { filters, values } = parseTutorFilters(raw);

  const [subjects, cities, tutors] = await Promise.all([
    getSubjects(),
    getListedCities(),
    searchTutors(filters),
  ]);

  const hasFilters = Boolean(
    values.subject ||
      values.grade ||
      values.mode ||
      values.max_fee ||
      values.city ||
      values.area ||
      values.q
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        action="/"
        method="get"
        className="rounded-lg border p-4 grid gap-3 md:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Subject
          <select name="subject" defaultValue={values.subject} className={fieldClass}>
            <option value="">Any subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Class
          <select name="grade" defaultValue={values.grade} className={fieldClass}>
            <option value="">Any class</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          How they teach
          <select name="mode" defaultValue={values.mode} className={fieldClass}>
            <option value="">Online or in person</option>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Max fee per hour (Rs)
          <input
            type="number"
            name="max_fee"
            min={0}
            max={100000}
            step={100}
            defaultValue={values.max_fee}
            placeholder="e.g. 2000"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          City
          <select name="city" defaultValue={values.city} className={fieldClass}>
            <option value="">Any city</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Area
          <input
            type="text"
            name="area"
            maxLength={80}
            defaultValue={values.area}
            placeholder="e.g. Gulberg"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Name or keyword
          <input
            type="text"
            name="q"
            maxLength={80}
            defaultValue={values.q}
            placeholder="e.g. O-level"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Sort by
          <select name="sort" defaultValue={values.sort} className={fieldClass}>
            <option value="fee_asc">Fee: low to high</option>
            <option value="fee_desc">Fee: high to low</option>
            <option value="verified">Verified first</option>
          </select>
        </label>

        <div className="md:col-span-4 flex items-center gap-3">
          <Button type="submit">Search tutors</Button>
          {hasFilters && (
            <Link href="/" className="text-sm underline underline-offset-4">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <div>
        <h2 className="text-lg font-medium">
          {tutors.length === 1 ? '1 tutor found' : `${tutors.length} tutors found`}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Profiles marked &quot;Not yet verified&quot; have not been checked by
          an administrator.
        </p>
      </div>

      {tutors.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'No tutors match these filters. Try a higher maximum fee, a different area, or online tutors.'
              : 'No tutors are listed yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tutors.map((t) => (
            <TutorResultCard key={t.id} tutor={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <SiteNav />

      <section className="w-full max-w-5xl px-5 pt-12 pb-6 flex flex-col gap-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Find the right tutor for your child
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Search by subject, class, fee and area. Compare online and in-person
          options, then follow your child&apos;s progress in one place.
        </p>
      </section>

      <div className="w-full max-w-5xl px-5 pb-12 flex-1">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading tutors…</p>}
        >
          <SearchSection searchParams={searchParams} />
        </Suspense>
      </div>

      <footer className="w-full flex items-center justify-center border-t text-center text-xs gap-8 py-10">
        <p>Lernivoza · tutor discovery and progress tracking</p>
        <ThemeSwitcher />
      </footer>
    </main>
  );
}