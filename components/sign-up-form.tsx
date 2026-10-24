'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateSignUp, type SignUpRole } from '@/lib/validations/auth';

const ROLES: { value: SignUpRole; label: string; description: string }[] = [
  { value: 'parent', label: 'Parent', description: 'Find tutors and track your child' },
  { value: 'student', label: 'Student', description: 'See your grades and assignments' },
  { value: 'teacher', label: 'Teacher', description: 'Manage students and records' },
];

export function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignUpRole>('parent');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateSignUp({ fullName, email, password, role });
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1. Create the auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setError('Signup succeeded but no user ID was returned.');
      setLoading(false);
      return;
    }

    // 2. Insert the matching profile row
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, role, full_name: fullName.trim() });

    if (profileError) {
      setError(
        `Account created, but profile setup failed: ${profileError.message}. Please contact support.`
      );
      setLoading(false);
      return;
    }

    // 3. Send the user into their dashboard
    router.push('/protected');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="mb-2 block">I am a...</Label>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                role === r.value
                  ? 'border-primary bg-primary/10'
                  : 'border-input hover:border-primary/50'
              }`}
            >
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}