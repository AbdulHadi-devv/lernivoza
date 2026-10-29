'use server';

import { createClient } from '@/lib/supabase/server';

export type ParentLinkStatus = 'pending' | 'approved' | 'declined' | 'revoked';

export interface ParentChildLink {
  id: string;
  parent_id: string;
  child_id: string;
  status: ParentLinkStatus;
  created_at: string;
  parent_name?: string;
  child_name?: string;
}

/**
 * Parent requests a link to a child by email.
 * Rejects self-links and non-student accounts.
 */
export async function requestChildLink(
  childEmail: string
): Promise<{ link?: ParentChildLink; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const email = childEmail.trim().toLowerCase();
  if (!email) return { error: 'Enter the child\'s email address.' };

  // Reject self-link early (their own email)
  const ownEmail = user.email?.toLowerCase();
  if (ownEmail && email === ownEmail) {
    return { error: 'You cannot link yourself as your own child.' };
  }

  // Look up the child's profile via the security-definer function
  const { data: found, error: lookupError } = await supabase.rpc(
    'find_profile_by_email',
    { email_input: email }
  );
  if (lookupError) return { error: lookupError.message };
  if (!found || found.length === 0) {
    return {
      error:
        'No account with that email exists yet. Ask your child to sign up first, then request again.',
    };
  }
  const childId = found[0].id as string;
  const childRole = found[0].role as string;
  if (childRole !== 'student') {
    return { error: 'That email does not belong to a student account.' };
  }

  const { data: link, error: insertError } = await supabase
    .from('parent_child_links')
    .insert({
      parent_id: user.id,
      child_id: childId,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'A link request already exists for this child.' };
    }
    return { error: insertError.message };
  }

  return { link: link as ParentChildLink };
}

/**
 * Returns all parent→child links where the current user is the parent,
 * joined with the child's name.
 */
export async function getLinksForParent(): Promise<ParentChildLink[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('parent_child_links')
    .select('*, child:child_id(full_name)')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    child_name: row.child?.full_name ?? 'Unknown',
  }));
}

/**
 * Returns all links where the current user is the child (incoming parent requests).
 * Joined with the parent's name.
 */
export async function getLinksForChild(): Promise<ParentChildLink[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('parent_child_links')
    .select('*, parent:parent_id(full_name)')
    .eq('child_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    parent_name: row.parent?.full_name ?? 'Unknown',
  }));
}

/**
 * Child approves or declines a parent link request.
 */
export async function decideParentLink(
  linkId: string,
  decision: 'approved' | 'declined'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('parent_child_links')
    .update({ status: decision })
    .eq('id', linkId)
    .eq('child_id', user.id)
    .eq('status', 'pending');

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Parent revokes a previously approved link (status → 'revoked').
 */
export async function revokeParentLink(
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('parent_child_links')
    .update({ status: 'revoked' })
    .eq('id', linkId)
    .eq('parent_id', user.id)
    .eq('status', 'approved');

  if (error) return { success: false, error: error.message };
  return { success: true };
}