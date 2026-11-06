'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getMyTutorProfile,
  getSubjects,
  saveMyTutorProfile,
  type SubjectOption,
} from '@/lib/supabase/tutors';
import {
  CITY_SUGGESTIONS,
  GRADES,
  MAX_BIO_LENGTH,
  MIN_LISTING_BIO_LENGTH,
  verificationLabel,
  type TeachingMode,
  type VerificationStatus,
} from '@/lib/supabase/tutors-utils';
import { Button } from '@/components/ui/button';

const fieldClass =
  'w-full rounded border px-3 py-2 text-sm bg-background text-foreground';

export default function TeacherProfilePage() {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [qualification, setQualification] = useState('');
  const [mode, setMode] = useState<TeachingMode | ''>('');
  const [fee, setFee] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [gradeMin, setGradeMin] = useState('');
  const [gradeMax, setGradeMax] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [listed, setListed] = useState(false);
  const [verification, setVerification] =
    useState<VerificationStatus>('unverified');

  useEffect(() => {
    let active = true;
    Promise.all([getSubjects(), getMyTutorProfile()]).then(([subs, mine]) => {
      if (!active) return;
      setSubjects(subs);
      if (mine) {
        setProfileId(mine.id);
        setBio(mine.bio ?? '');
        setQualification(mine.qualification ?? '');
        setMode(mine.teaching_mode ?? '');
        setFee(mine.hourly_fee_pkr !== null ? String(mine.hourly_fee_pkr) : '');
        setCity(mine.city ?? '');
        setArea(mine.area ?? '');
        setGradeMin(mine.grade_min !== null ? String(mine.grade_min) : '');
        setGradeMax(mine.grade_max !== null ? String(mine.grade_max) : '');
        setSubjectIds(mine.subject_ids);
        setListed(mine.is_listed);
        setVerification(mine.verification_status);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function toggleSubject(id: string) {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await saveMyTutorProfile({
      bio,
      qualification,
      teaching_mode: mode === '' ? null : mode,
      hourly_fee_pkr: fee === '' ? null : Number(fee),
      city,
      area,
      grade_min: gradeMin === '' ? null : Number(gradeMin),
      grade_max: gradeMax === '' ? null : Number(gradeMax),
      subject_ids: subjectIds,
      is_listed: listed,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Could not save your profile.');
      return;
    }
    if (result.id) setProfileId(result.id);
    setSaved(true);
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Tutor Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              This is what parents see when they search for tutors.
            </p>
          </div>
          <Link href="/teacher" className="text-sm underline underline-offset-4">
            ← Dashboard
          </Link>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1 text-sm">
            About you
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX_BIO_LENGTH}
              rows={5}
              placeholder="Your teaching experience, style and the results you aim for."
              className={`${fieldClass} resize-y`}
            />
            <span className="text-xs text-muted-foreground">
              {bio.length}/{MAX_BIO_LENGTH} (at least {MIN_LISTING_BIO_LENGTH} to
              list your profile)
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Qualification
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              maxLength={200}
              placeholder="e.g. MSc Mathematics, 6 years teaching O-level"
              className={fieldClass}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm mb-1">Subjects you teach</legend>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {subjects.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              How you teach
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TeachingMode | '')}
                className={fieldClass}
              >
                <option value="">Choose…</option>
                <option value="online">Online</option>
                <option value="in_person">In person</option>
                <option value="both">Online and in person</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Fee per hour (Rs)
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                min={0}
                max={100000}
                step={50}
                placeholder="e.g. 1500"
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              City
              <input
                type="text"
                list="city-suggestions"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                placeholder="e.g. Lahore"
                className={fieldClass}
              />
              <datalist id="city-suggestions">
                {CITY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Area
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                maxLength={80}
                placeholder="e.g. Gulberg"
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              First class you teach
              <select
                value={gradeMin}
                onChange={(e) => setGradeMin(e.target.value)}
                className={fieldClass}
              >
                <option value="">Choose…</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Last class you teach
              <select
                value={gradeMax}
                onChange={(e) => setGradeMax(e.target.value)}
                className={fieldClass}
              >
                <option value="">Choose…</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border p-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={listed}
                onChange={(e) => setListed(e.target.checked)}
              />
              Show my profile in tutor search
            </label>
            <p className="text-xs text-muted-foreground">
              To list your profile you need a bio, at least one subject, a fee,
              how you teach, your classes and your city.
            </p>
            <p className="text-xs text-muted-foreground">
              Verification: {verificationLabel(verification)}. Profiles are
              checked by an administrator; this is not available yet.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-green-700">
              Profile saved.{' '}
              {listed && profileId && (
                <Link
                  href={`/tutors/${profileId}`}
                  className="underline underline-offset-4"
                >
                  View your public profile →
                </Link>
              )}
            </p>
          )}

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}