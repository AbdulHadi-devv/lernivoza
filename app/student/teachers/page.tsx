'use client';

import { useState, useEffect } from 'react';
import { getIncomingLinks, decideLink, type TeacherStudentLink } from '@/lib/supabase/links';
import { Button } from '@/components/ui/button';

export default function StudentTeachersPage() {
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
  const approved = links.filter((l) => l.status === 'approved');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">My Teachers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Teachers linked to you and pending link requests.
        </p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-medium mb-3">
              Pending Requests ({pending.length})
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
                      <p className="text-xs text-muted-foreground">
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
            <h2 className="text-lg font-medium mb-3">My Teachers ({approved.length})</h2>
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved teachers yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {approved.map((link) => (
                  <div key={link.id} className="rounded-lg border p-4">
                    <p className="font-medium">{link.teacher_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Linked since {new Date(link.decided_at ?? link.created_at).toLocaleDateString()}
                    </p>
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