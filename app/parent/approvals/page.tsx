'use client';

import { useState, useEffect } from 'react';
import { getIncomingLinks, decideLink, type TeacherStudentLink } from '@/lib/supabase/links';
import { Button } from '@/components/ui/button';

export default function ParentApprovalsPage() {
  const [links, setLinks] = useState<TeacherStudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await getIncomingLinks();
    setLinks(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(linkId: string, decision: 'approved' | 'declined') {
    setError(null);
    const result = await decideLink(linkId, decision);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  const pending = links.filter((l) => l.status === 'pending');
  const decided = links.filter((l) => l.status !== 'pending');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Teacher Link Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Teachers who want to record assessments for your child need your approval.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-medium mb-3">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pending.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-lg border p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{link.teacher_name}</p>
                      <p className="text-sm text-muted-foreground">
                        wants to teach <span className="font-medium">{link.student_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested {new Date(link.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDecision(link.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecision(link.id, 'declined')}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium mb-3">History</h2>
            {decided.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing decided yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {decided.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-lg border p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{link.teacher_name}</p>
                      <p className="text-sm text-muted-foreground">
                        for <span className="font-medium">{link.student_name}</span>
                      </p>
                    </div>
                    <StatusBadge status={link.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
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