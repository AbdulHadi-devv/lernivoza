export type SignUpRole = 'parent' | 'student' | 'teacher';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  role: SignUpRole;
}

export function validateSignUp(input: SignUpInput): string | null {
  if (!input.fullName || input.fullName.trim().length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return 'Please enter a valid email address.';
  }
  if (input.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!['parent', 'student', 'teacher'].includes(input.role)) {
    return 'Please choose a valid role.';
  }
  return null;
}