'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestStudentLink, getLinksForTeacher, revokeLink, type TeacherStudentLink } from '@/lib/supabase/links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TeacherStudentsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [links, setLinks] = useState<TeacherStudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load existing links on mount
  useEffect(() => {
    let active = true;
    getLinksForTeacher().then((data) => {
      if (active) {
        setLinks(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Enter the student\'s email address.');
      return;
    }

    const result = await requestStudentLink(email);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(`Request sent to ${email}. Waiting for approval.`);
    setEmail('');
    startTransition(() => router.refresh());
    // Reload links
    const refreshed = await getLinksForTeacher();
    setLinks(refreshed);
  }

  async function handleRevoke(linkId: string) {
    const result = await revokeLink(linkId);
    if (result.error) {
      setError(result.error);
      return;
    }
    const refreshed = await getLinksForTeacher();
    setLinks(refreshed);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">My Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link to a student by their email. Once they approve, you can record assessments and attendance.
        </p>
      </div>

      {/* Request form */}
      <form onSubmit={handleRequest} className="rounded-lg border p-5 flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="student-email">Student email</Label>
          <Input
            id="student-email"
            type="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {success && <p className="text-sm text-green-600" role="status">{success}</p>}

        <Button type="submit" disabled={isPending} className="self-start">
          {isPending ? 'Sending…' : 'Send link request'}
        </Button>
      </form>

      {/* Links list */}
      <div>
        <h2 className="text-lg font-medium mb-3">Your Links</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No link requests yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="rounded-lg border p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{link.student_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(link.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={link.status} />
                  {link.status === 'approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(link.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    revoked: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}