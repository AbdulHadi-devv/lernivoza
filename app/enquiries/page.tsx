'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  cancelEnquiry,
  getMyEnquiries,
  respondToEnquiry,
} from '@/lib/supabase/enquiries';
import {
  enquiryStatusClass,
  enquiryStatusLabel,
  type Enquiry,
} from '@/lib/supabase/enquiries-utils';
import { Button } from '@/components/ui/button';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getMyEnquiries();
    setEnquiries(result.enquiries);
    setRole(result.role);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRespond(enquiry: Enquiry, accept: boolean) {
    const question = accept
      ? `Accept this enquiry? ${enquiry.child_name} will be linked to you, and you can record marks, attendance and assignments for them.`
      : 'Decline this enquiry?';
    if (!window.confirm(question)) return;

    setBusyId(enquiry.id);
    setError(null);
    setNotice(null);
    const result = await respondToEnquiry(enquiry.id, accept);
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? 'Could not answer the enquiry.');
      return;
    }
    if (accept) {
      setNotice(`${enquiry.child_name} is now linked to you.`);
    }
    await load();
  }

  async function handleCancel(enquiry: Enquiry) {
    if (!window.confirm('Cancel this enquiry?')) return;
    setBusyId(enquiry.id);
    setError(null);
    setNotice(null);
    const result = await cancelEnquiry(enquiry.id);
    setBusyId(null);
    if (!result.success) {
      setError(result.error ?? 'Could not cancel the enquiry.');
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  const isTeacher = role === 'teacher';
  const pending = enquiries.filter((e) => e.status === 'pending');
  const answered = enquiries.filter((e) => e.status !== 'pending');

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {isTeacher ? 'Enquiries' : 'My Enquiries'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isTeacher
                ? 'Requests from parents who want you to teach their child.'
                : 'Requests you have sent to tutors.'}
            </p>
          </div>
          <Link
            href="/protected"
            className="text-sm underline underline-offset-4"
          >
            ← Dashboard
          </Link>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-green-700">
            {notice}{' '}
            <Link href="/teacher/students" className="underline underline-offset-4">
              Open My Students →
            </Link>
          </p>
        )}

        {enquiries.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isTeacher
                ? 'No enquiries yet. Make sure your tutor profile is listed so parents can find you.'
                : 'You have not sent any enquiries yet.'}
            </p>
            <Button asChild className="mt-3">
              <Link href={isTeacher ? '/teacher/profile' : '/'}>
                {isTeacher ? 'Edit my tutor profile' : 'Find a tutor'}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">Waiting for a reply</h2>
                {pending.map((e) => (
                  <EnquiryCard
                    key={e.id}
                    enquiry={e}
                    isTeacher={isTeacher}
                    busy={busyId === e.id}
                    onAccept={() => handleRespond(e, true)}
                    onDecline={() => handleRespond(e, false)}
                    onCancel={() => handleCancel(e)}
                  />
                ))}
              </section>
            )}

            {answered.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">History</h2>
                {answered.map((e) => (
                  <EnquiryCard
                    key={e.id}
                    enquiry={e}
                    isTeacher={isTeacher}
                    busy={false}
                    onAccept={() => {}}
                    onDecline={() => {}}
                    onCancel={() => {}}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EnquiryCard({
  enquiry,
  isTeacher,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  enquiry: Enquiry;
  isTeacher: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {isTeacher ? (
            <>
              <p className="font-medium">
                {enquiry.parent_name}{' '}
                <span className="text-muted-foreground font-normal">
                  for {enquiry.child_name}
                </span>
              </p>
            </>
          ) : (
            <p className="font-medium">
              <Link
                href={`/tutors/${enquiry.teacher_id}`}
                className="underline underline-offset-4"
              >
                {enquiry.teacher_name}
              </Link>{' '}
              <span className="text-muted-foreground font-normal">
                for {enquiry.child_name}
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {enquiry.subject_name ?? 'No subject chosen'} · sent{' '}
            {new Date(enquiry.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${enquiryStatusClass(
            enquiry.status
          )}`}
        >
          {enquiryStatusLabel(enquiry.status)}
        </span>
      </div>

      {enquiry.message && (
        <p className="text-sm whitespace-pre-wrap break-words rounded bg-muted/50 p-3">
          {enquiry.message}
        </p>
      )}

      {enquiry.status === 'pending' && (
        <div className="flex gap-2">
          {isTeacher ? (
            <>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDecline}
                disabled={busy}
              >
                Decline
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel enquiry
            </Button>
          )}
        </div>
      )}

      {enquiry.status === 'accepted' && (
        <p className="text-sm text-muted-foreground">
          {isTeacher
            ? `${enquiry.child_name} is linked to you. You can message the parent from `
            : `${enquiry.child_name} is now linked to ${enquiry.teacher_name}. You can message them from `}
          <Link href="/messages" className="underline underline-offset-4">
            Messages
          </Link>
          .
        </p>
      )}
    </div>
  );
}