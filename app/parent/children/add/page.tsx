'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestChildLink } from '@/lib/supabase/parent-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddChildPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await requestChildLink(email);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push('/parent/children');
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="text-2xl font-semibold">Add a Child</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the email of your child's Lernivoza account. They will receive a
          request to approve the link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Child's email</Label>
          <Input
            id="email"
            type="email"
            placeholder="child@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send link request'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/parent/children')}
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Note</p>
        <p>
          Your child must already have a Lernivoza student account before you
          can link. If they haven't signed up yet, ask them to create an account
          first.
        </p>
      </div>
    </div>
  );
}