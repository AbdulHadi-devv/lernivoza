'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendEnquiry } from '@/lib/supabase/enquiries';
import { MAX_ENQUIRY_MESSAGE_LENGTH } from '@/lib/supabase/enquiries-utils';
import { Button } from '@/components/ui/button';

interface Option {
  id: string;
  name: string;
}

const fieldClass =
  'w-full rounded border px-3 py-2 text-sm bg-background text-foreground';

export function EnquiryForm({
  teacherId,
  teacherName,
  childOptions,
  subjectOptions,
}: {
  teacherId: string;
  teacherName: string;
  childOptions: Option[];
  subjectOptions: Option[];
}) {
  const [childId, setChildId] = useState(childOptions[0]?.id ?? '');
  const [subjectId, setSubjectId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!childId) {
      setError('Choose a child.');
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendEnquiry({
      teacher_id: teacherId,
      child_id: childId,
      subject_id: subjectId || null,
      message,
    });
    setSending(false);
    if (!result.success) {
      setError(result.error ?? 'Could not send the enquiry.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-lg border p-4 flex flex-col gap-2">
        <p className="font-medium">Enquiry sent</p>
        <p className="text-sm text-muted-foreground">
          {teacherName} will see it on their dashboard. If they accept, your
          child is linked to them and you can message each other.
        </p>
        <Link
          href="/enquiries"
          className="text-sm underline underline-offset-4 w-fit"
        >
          View my enquiries →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 flex flex-col gap-4">
      <div>
        <h2 className="font-medium">Send an enquiry</h2>
        <p className="text-xs text-muted-foreground mt-1">
          If {teacherName} accepts, they are linked to your child and can record
          marks, attendance and assignments for them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Child
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className={fieldClass}
          >
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Subject (optional)
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Not sure yet</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Message (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_ENQUIRY_MESSAGE_LENGTH}
          rows={4}
          placeholder="Tell the tutor what your child needs help with and when."
          className={`${fieldClass} resize-y`}
        />
        <span className="text-xs text-muted-foreground">
          {message.length}/{MAX_ENQUIRY_MESSAGE_LENGTH}
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send enquiry'}
        </Button>
      </div>
    </form>
  );
}