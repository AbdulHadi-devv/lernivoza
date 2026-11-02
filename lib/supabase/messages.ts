'use server';

import { createClient } from '@/lib/supabase/server';

export interface Contact {
  user_id: string;
  full_name: string;
  role: string;
  context: string | null;
}

export interface ConversationSummary {
  conversation_id: string;
  other_id: string;
  other_name: string;
  other_role: string;
  context: string | null;
  can_send: boolean;
  last_body: string | null;
  last_at: string;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/**
 * People the signed-in user may message right now
 * (parent -> teachers of their children, teacher -> parents of their students).
 */
export async function getContacts(): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_contacts');
  if (error || !data) return [];
  return data as Contact[];
}

/**
 * Conversation list, newest first, with unread counts.
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_conversations');
  if (error || !data) return [];
  return (data as ConversationSummary[]).map((c) => ({
    ...c,
    unread_count: Number(c.unread_count),
  }));
}

/**
 * Open (or reopen) a conversation with a permitted contact.
 */
export async function startConversation(
  otherId: string
): Promise<{ conversationId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_conversation', {
    other: otherId,
  });
  if (error) return { error: error.message };
  return { conversationId: data as string };
}

/**
 * Messages in a conversation (latest 200, oldest first).
 * Opening a thread marks the other person's messages as read.
 */
export async function getThread(
  conversationId: string
): Promise<{ me: string | null; messages: ChatMessage[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { me: null, messages: [] };

  await supabase.rpc('mark_conversation_read', { conv: conversationId });

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, read_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return { me: user.id, messages: [] };
  return { me: user.id, messages: (data as ChatMessage[]).reverse() };
}

/**
 * Send a message. The database re-checks the link on every send.
 */
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_message', {
    conv: conversationId,
    message_body: body,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Report a message you received.
 */
export async function reportMessage(
  messageId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_message', {
    msg: messageId,
    report_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Total unread messages (dashboard badge).
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unread_message_count');
  if (error) return 0;
  return Number(data ?? 0);
}