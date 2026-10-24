import Link from 'next/link';
import { SignUpForm } from '@/components/sign-up-form';

export default function SignUpPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Create your Lernivoza account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free to start. Choose what you are — you can change details later.
        </p>
      </div>

      <SignUpForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}